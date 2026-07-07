'use strict';
const { Op } = require('sequelize');
const { Attendance, Shift, OfficeLocation, User, WfaRequest } = require('../models');
const { companyFilter, companyId } = require('../helpers/tenancy');
const { paginate, buildFilter, paginatedResponse } = require('../helpers/queryHelper');
const { distanceInMeters } = require('../helpers/geo');
const { userHasPermission } = require('../helpers/permCheck');
const { todayDateOnly, nowPartsInJakarta } = require('../helpers/timezone');

const USER_ATTRS = ['id', 'name', 'email', 'divisi'];

async function resolveOfficeLocation(req, lat, lng) {
    const locations = await OfficeLocation.findAll({ where: { ...companyFilter(req) } });
    if (!locations.length) {
        throw { name: 'BadRequest', message: 'Belum ada lokasi kantor yang dikonfigurasi' };
    }
    let nearest = null;
    let nearestDistance = Infinity;
    for (const loc of locations) {
        const d = distanceInMeters(lat, lng, Number(loc.latitude), Number(loc.longitude));
        if (d < nearestDistance) {
            nearestDistance = d;
            nearest = loc;
        }
    }
    if (nearestDistance > nearest.radiusMeters) {
        throw {
            name: 'BadRequest',
            message: `Anda berada ${Math.round(nearestDistance)}m dari lokasi kantor terdekat (${nearest.name}), maksimal ${nearest.radiusMeters}m`,
        };
    }
    return nearest;
}

const WORK_MODES = ['ON_SITE', 'WFA', 'FIELD'];

// Menentukan lokasi & mode kerja saat check-in/out. ON_SITE tetap divalidasi
// jarak ke kantor; WFA butuh pengajuan yang sudah APPROVED untuk tanggal itu;
// FIELD (kerja lapangan) self-declared, wajib isi catatan tujuan (hanya saat
// check-in), tanpa approval.
async function resolveWorkContext(req, { lat, lng, note, workMode, date, requireFieldNote = false }) {
    const mode = WORK_MODES.includes(workMode) ? workMode : 'ON_SITE';

    if (mode === 'FIELD') {
        if (requireFieldNote && (!note || !note.trim())) {
            throw { name: 'BadRequest', message: 'Catatan tujuan wajib diisi untuk mode Kerja Lapangan' };
        }
        return { mode, locationId: null };
    }

    if (mode === 'WFA') {
        const approved = await WfaRequest.findOne({
            where: { userId: req.user.id, date, status: 'APPROVED' },
        });
        if (!approved) {
            throw { name: 'BadRequest', message: 'Belum ada pengajuan WFA yang disetujui untuk tanggal ini' };
        }
        return { mode, locationId: null };
    }

    const location = await resolveOfficeLocation(req, lat, lng);
    return { mode: 'ON_SITE', locationId: location.id };
}

class AttendanceController {
    static async today(req, res, next) {
        try {
            const attendance = await Attendance.findOne({
                where: { userId: req.user.id, date: todayDateOnly() },
                include: [
                    { model: Shift, as: 'shift' },
                    { model: OfficeLocation, as: 'checkInLocation' },
                    { model: OfficeLocation, as: 'checkOutLocation' },
                ],
            });
            res.json(attendance);
        } catch (err) { next(err); }
    }

    static async checkIn(req, res, next) {
        try {
            const { lat, lng, note, workMode } = req.body;
            if (lat === undefined || lng === undefined) {
                throw { name: 'BadRequest', message: 'Lokasi (lat, lng) wajib diisi' };
            }
            if (!req.file) {
                throw { name: 'BadRequest', message: 'Foto selfie wajib diambil saat check-in' };
            }

            const date = todayDateOnly();
            let attendance = await Attendance.findOne({ where: { userId: req.user.id, date } });
            if (attendance?.checkInAt) {
                throw { name: 'BadRequest', message: 'Anda sudah check-in hari ini' };
            }

            const { mode, locationId } = await resolveWorkContext(req, { lat, lng, note, workMode, date, requireFieldNote: true });

            // Kerja Lapangan self-declared tanpa approval sebelumnya — record
            // masuk antrean review, tapi timestamp & foto tetap terkunci sekarang.
            const reviewStatus = mode === 'FIELD' ? 'PENDING_REVIEW' : 'NONE';

            const user = await User.findByPk(req.user.id, { include: [{ model: Shift, as: 'shift' }] });
            let status = 'PRESENT';
            const now = new Date();
            if (user.shift) {
                const { hour, minute } = nowPartsInJakarta();
                const nowMinutes = hour * 60 + minute;
                const [h, m] = user.shift.startTime.split(':').map(Number);
                const shiftStartMinutes = h * 60 + m;
                const graceMinutes = 15;
                if (nowMinutes > shiftStartMinutes + graceMinutes) status = 'LATE';
            }

            const payload = {
                userId: req.user.id,
                date,
                shiftId: user.shiftId || null,
                checkInAt: now,
                checkInLat: lat,
                checkInLng: lng,
                checkInLocationId: locationId,
                checkInPhoto: req.file.path,
                status,
                workMode: mode,
                note: note || null,
                reviewStatus,
                companyId: companyId(req) ?? req.user.companyId,
            };

            if (attendance) {
                await attendance.update(payload);
            } else {
                attendance = await Attendance.create(payload);
            }

            res.status(200).json(attendance);
        } catch (err) { next(err); }
    }

    static async checkOut(req, res, next) {
        try {
            const { lat, lng, note, workMode } = req.body;
            if (lat === undefined || lng === undefined) {
                throw { name: 'BadRequest', message: 'Lokasi (lat, lng) wajib diisi' };
            }
            if (!req.file) {
                throw { name: 'BadRequest', message: 'Foto selfie wajib diambil saat check-out' };
            }

            const date = todayDateOnly();
            const attendance = await Attendance.findOne({ where: { userId: req.user.id, date } });
            if (!attendance || !attendance.checkInAt) {
                throw { name: 'BadRequest', message: 'Anda belum check-in hari ini' };
            }
            if (attendance.checkOutAt) {
                throw { name: 'BadRequest', message: 'Anda sudah check-out hari ini' };
            }

            // Mode kerja mengikuti yang dipakai saat check-in, kecuali user
            // menyatakan pindah ke Kerja Lapangan (mis. check-in di kantor tapi
            // siangnya ada tugas ke vendor). Satu-satunya transisi yang
            // diperbolehkan: ON_SITE -> FIELD. Transisi lain tetap ditolak.
            const isSwitchingToField = workMode === 'FIELD' && attendance.workMode !== 'FIELD';
            if (isSwitchingToField && attendance.workMode !== 'ON_SITE') {
                throw { name: 'BadRequest', message: 'Perubahan mode saat check-out tidak diperbolehkan untuk mode ini' };
            }
            const effectiveMode = isSwitchingToField ? 'FIELD' : attendance.workMode;

            const { locationId } = await resolveWorkContext(req, {
                lat, lng, note, workMode: effectiveMode, date,
                requireFieldNote: isSwitchingToField,
            });

            await attendance.update({
                checkOutAt: new Date(),
                checkOutLat: lat,
                checkOutLng: lng,
                checkOutLocationId: locationId,
                checkOutPhoto: req.file.path,
                checkOutWorkMode: isSwitchingToField ? 'FIELD' : attendance.checkOutWorkMode,
                note: note || attendance.note,
                reviewStatus: (isSwitchingToField || attendance.workMode === 'FIELD')
                    ? 'PENDING_REVIEW'
                    : attendance.reviewStatus,
            });

            res.status(200).json(attendance);
        } catch (err) { next(err); }
    }

    static async list(req, res, next) {
        try {
            const { page, limit, offset } = paginate(req.query);
            const filter = buildFilter(req.query, {
                status:   'exact',
                dateFrom: { field: 'date', type: 'gte' },
                dateTo:   { field: 'date', type: 'lte' },
            });

            const canViewAll = await userHasPermission(req, 'hris.attendance.edit')
                || await userHasPermission(req, 'hris.reports.view');
            const selfFilter = canViewAll && req.query.userId ? { userId: req.query.userId } : (canViewAll ? {} : { userId: req.user.id });

            const { rows, count } = await Attendance.findAndCountAll({
                where: { ...companyFilter(req), ...filter, ...selfFilter },
                include: [
                    { model: User, as: 'user', attributes: USER_ATTRS },
                    { model: Shift, as: 'shift' },
                ],
                order: [['date', 'DESC']],
                limit, offset,
                distinct: true,
            });
            res.json(paginatedResponse(rows, count, page, limit));
        } catch (err) { next(err); }
    }

    static async summary(req, res, next) {
        try {
            const month = parseInt(req.query.month) || (new Date().getMonth() + 1);
            const year  = parseInt(req.query.year)  || new Date().getFullYear();
            const start = `${year}-${String(month).padStart(2, '0')}-01`;
            const endDate = new Date(year, month, 0).getDate();
            const end   = `${year}-${String(month).padStart(2, '0')}-${String(endDate).padStart(2, '0')}`;

            const rows = await Attendance.findAll({
                where: {
                    userId: req.query.userId || req.user.id,
                    date: { [Op.between]: [start, end] },
                    ...companyFilter(req),
                },
            });

            const summary = { PRESENT: 0, LATE: 0, ABSENT: 0, LEAVE: 0, HALF_DAY: 0, total: rows.length };
            rows.forEach(r => { summary[r.status] = (summary[r.status] || 0) + 1; });
            res.json(summary);
        } catch (err) { next(err); }
    }

    static async pendingReview(req, res, next) {
        try {
            const { page, limit, offset } = paginate(req.query);

            const { rows, count } = await Attendance.findAndCountAll({
                where: { ...companyFilter(req), reviewStatus: 'PENDING_REVIEW' },
                include: [
                    { model: User, as: 'user', attributes: USER_ATTRS },
                    { model: Shift, as: 'shift' },
                ],
                order: [['date', 'DESC']],
                limit, offset,
                distinct: true,
            });
            res.json(paginatedResponse(rows, count, page, limit));
        } catch (err) { next(err); }
    }

    static async review(req, res, next) {
        try {
            const { status, reviewNote } = req.body;
            if (!['APPROVED', 'REJECTED'].includes(status)) {
                throw { name: 'BadRequest', message: 'Status review harus APPROVED atau REJECTED' };
            }

            const attendance = await Attendance.findOne({ where: { id: req.params.id, ...companyFilter(req) } });
            if (!attendance) throw { name: 'NotFound', message: 'Data absensi tidak ditemukan' };
            if (attendance.reviewStatus !== 'PENDING_REVIEW') {
                throw { name: 'BadRequest', message: 'Data absensi ini tidak sedang menunggu review' };
            }

            // Reject tidak mengubah jam kerja yang sudah tercatat — cuma jadi
            // catatan HR untuk ditindaklanjuti manual, bukan otomatis ABSENT.
            await attendance.update({
                reviewStatus: status,
                reviewedBy: req.user.id,
                reviewedAt: new Date(),
                reviewNote: reviewNote || null,
            });

            res.json(attendance);
        } catch (err) { next(err); }
    }

    static async update(req, res, next) {
        try {
            const attendance = await Attendance.findOne({ where: { id: req.params.id, ...companyFilter(req) } });
            if (!attendance) throw { name: 'NotFound', message: 'Data absensi tidak ditemukan' };

            const { status, note, checkInAt, checkOutAt } = req.body;
            await attendance.update({
                status:     status     ?? attendance.status,
                note:       note       ?? attendance.note,
                checkInAt:  checkInAt  ?? attendance.checkInAt,
                checkOutAt: checkOutAt ?? attendance.checkOutAt,
                editedBy: req.user.id,
            });

            res.json(attendance);
        } catch (err) { next(err); }
    }
}

module.exports = AttendanceController;
