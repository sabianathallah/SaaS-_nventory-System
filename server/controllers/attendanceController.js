'use strict';
const { Op } = require('sequelize');
const { Attendance, Shift, OfficeLocation, User, WfaRequest, LateExcuseRequest, SickLeaveRequest, LeaveRequest } = require('../models');
const { companyFilter, companyId } = require('../helpers/tenancy');
const { paginate, buildFilter, paginatedResponse } = require('../helpers/queryHelper');
const { distanceInMeters } = require('../helpers/geo');
const { userHasPermission } = require('../helpers/permCheck');
const { todayDateOnly, nowPartsInJakarta, addDaysStr, weekdayOf } = require('../helpers/timezone');
const { lateSeverity } = require('../helpers/lateSeverity');

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
            const { lat, lng, note, workMode, lateReason } = req.body;
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

            // Izin Telat — kalau sebelumnya sudah ada pengajuan yang di-approve
            // untuk tanggal ini, telat otomatis dianggap PRESENT (tidak perlu
            // direview lagi). Kalau belum ada & user langsung isi alasan saat
            // check-in, masuk antrean review dulu.
            let lateExcusePatch = { lateExcuseStatus: 'NONE', lateExcuseReason: null, lateExcuseRequestId: null };
            if (status === 'LATE') {
                const approvedRequest = await LateExcuseRequest.findOne({
                    where: { userId: req.user.id, date, status: 'APPROVED' },
                });
                if (approvedRequest) {
                    status = 'PRESENT';
                    lateExcusePatch = {
                        lateExcuseStatus: 'APPROVED',
                        lateExcuseReason: approvedRequest.reason,
                        lateExcuseRequestId: approvedRequest.id,
                        lateExcuseReviewedBy: approvedRequest.reviewedBy,
                        lateExcuseReviewedAt: approvedRequest.reviewedAt,
                    };
                } else if (lateReason && lateReason.trim()) {
                    lateExcusePatch = { lateExcuseStatus: 'PENDING_REVIEW', lateExcuseReason: lateReason.trim() };
                }
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
                ...lateExcusePatch,
                companyId: companyId(req) ?? req.user.companyId,
            };

            try {
                if (attendance) {
                    await attendance.update(payload);
                } else {
                    attendance = await Attendance.create(payload);
                }
            } catch (err) {
                if (err.name === 'SequelizeUniqueConstraintError') {
                    throw { name: 'BadRequest', message: 'Anda sudah check-in hari ini' };
                }
                throw err;
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
                    { model: OfficeLocation, as: 'checkInLocation' },
                    { model: OfficeLocation, as: 'checkOutLocation' },
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
            const { year: jakartaYear, month: jakartaMonth } = nowPartsInJakarta();
            const month = parseInt(req.query.month) || jakartaMonth;
            const year  = parseInt(req.query.year)  || jakartaYear;
            const start = `${year}-${String(month).padStart(2, '0')}-01`;
            const endDate = new Date(year, month, 0).getDate();
            const end   = `${year}-${String(month).padStart(2, '0')}-${String(endDate).padStart(2, '0')}`;

            const canViewAll = await userHasPermission(req, 'hris.attendance.edit')
                || await userHasPermission(req, 'hris.reports.view');
            const userId = canViewAll && req.query.userId ? req.query.userId : req.user.id;

            const rows = await Attendance.findAll({
                where: {
                    userId,
                    date: { [Op.between]: [start, end] },
                    ...companyFilter(req),
                },
            });

            const summary = { PRESENT: 0, LATE: 0, ABSENT: 0, LEAVE: 0, HALF_DAY: 0, total: rows.length };
            rows.forEach(r => { summary[r.status] = (summary[r.status] || 0) + 1; });
            res.json(summary);
        } catch (err) { next(err); }
    }

    // Leaderboard kehadiran perusahaan bulan berjalan — cuma nama + avatar +
    // angka ringkasan, tanpa jam check-in/out atau data sensitif lain, karena
    // ditampilkan ke semua karyawan (bukan cuma admin) sebagai reminder.
    static async lateLeaderboard(req, res, next) {
        try {
            const { year: jakartaYear, month: jakartaMonth } = nowPartsInJakarta();
            const month = parseInt(req.query.month) || jakartaMonth;
            const year  = parseInt(req.query.year)  || jakartaYear;
            const start = `${year}-${String(month).padStart(2, '0')}-01`;
            const endDate = new Date(year, month, 0).getDate();
            const end   = `${year}-${String(month).padStart(2, '0')}-${String(endDate).padStart(2, '0')}`;
            const dateRange = { [Op.between]: [start, end] };

            const [rows, sickRows] = await Promise.all([
                Attendance.findAll({
                    where: { date: dateRange, ...companyFilter(req) },
                    include: [
                        { model: User, as: 'user', attributes: ['id', 'name', 'avatar'] },
                        { model: Shift, as: 'shift', attributes: ['startTime'] },
                    ],
                }),
                SickLeaveRequest.findAll({
                    where: { date: dateRange, status: 'APPROVED', ...companyFilter(req) },
                    include: [{ model: User, as: 'user', attributes: ['id', 'name', 'avatar'] }],
                }),
            ]);

            const byUser = new Map();
            const getUser = (id, u) => {
                let cur = byUser.get(id);
                if (!cur) {
                    cur = { userId: id, name: u?.name ?? '—', avatar: u?.avatar ?? null, lateCount: 0, presentCount: 0, absentCount: 0, sickCount: 0, severity: { RINGAN: 0, SEDANG: 0, BERAT: 0 } };
                    byUser.set(id, cur);
                }
                return cur;
            };

            rows.forEach(r => {
                if (!r.userId) return;
                const cur = getUser(r.userId, r.user);
                if (r.status === 'LATE') {
                    cur.lateCount += 1;
                    const severity = lateSeverity(r.checkInAt, r.shift?.startTime);
                    if (severity) cur.severity[severity.key] += 1;
                }
                if (r.status === 'PRESENT') cur.presentCount += 1;
                if (r.status === 'ABSENT') cur.absentCount += 1;
            });
            sickRows.forEach(r => {
                if (!r.userId) return;
                getUser(r.userId, r.user).sickCount += 1;
            });

            const all = Array.from(byUser.values());
            const mostLate = all.filter(u => u.lateCount > 0).sort((a, b) => b.lateCount - a.lateCount).slice(0, 5);
            const mostOnTime = all.filter(u => u.lateCount === 0 && u.presentCount > 0)
                .sort((a, b) => b.presentCount - a.presentCount).slice(0, 5);
            const mostAbsent = all.filter(u => u.absentCount > 0).sort((a, b) => b.absentCount - a.absentCount).slice(0, 5);
            const mostSick = all.filter(u => u.sickCount > 0).sort((a, b) => b.sickCount - a.sickCount).slice(0, 5);

            res.json({ mostLate, mostOnTime, mostAbsent, mostSick });
        } catch (err) { next(err); }
    }

    // Backfill ABSENT untuk karyawan bershift yang gak check-in, dari Senin
    // minggu ini sampai kemarin (Sabtu/Minggu di-skip, weekend dianggap
    // libur). Dilewati kalau user itu sudah punya record attendance hari
    // itu, atau punya cuti/WFA/izin sakit yang APPROVED buat tanggal itu —
    // supaya nggak salah tandai orang yang sebenarnya udah izin resmi.
    static async backfillAbsent(req, res, next) {
        try {
            const today = todayDateOnly();
            const daysSinceMonday = (weekdayOf(today) + 6) % 7;
            const monday = addDaysStr(today, -daysSinceMonday);
            const yesterday = addDaysStr(today, -1);

            if (yesterday < monday) {
                return res.json({ created: 0, dates: [], message: 'Belum ada hari kerja yang lewat minggu ini' });
            }

            const dates = [];
            for (let d = monday; d <= yesterday; d = addDaysStr(d, 1)) {
                const wd = weekdayOf(d);
                if (wd === 0 || wd === 6) continue;
                dates.push(d);
            }
            if (!dates.length) {
                return res.json({ created: 0, dates: [], message: 'Tidak ada hari kerja (Senin-Jumat) yang perlu dicek minggu ini' });
            }

            const users = await User.findAll({
                where: { shiftId: { [Op.ne]: null }, isActive: true, ...companyFilter(req) },
                attributes: ['id', 'companyId', 'shiftId'],
            });
            if (!users.length) return res.json({ created: 0, dates, message: 'Tidak ada karyawan dengan shift' });
            const userIds = users.map(u => u.id);

            const range = { [Op.between]: [dates[0], dates[dates.length - 1]] };

            const [existingAttendance, approvedLeaves, approvedWfa, approvedSick] = await Promise.all([
                Attendance.findAll({ where: { userId: userIds, date: range }, attributes: ['userId', 'date'] }),
                LeaveRequest.findAll({ where: { userId: userIds, status: 'APPROVED', startDate: { [Op.lte]: dates[dates.length - 1] }, endDate: { [Op.gte]: dates[0] } }, attributes: ['userId', 'startDate', 'endDate'] }),
                WfaRequest.findAll({ where: { userId: userIds, status: 'APPROVED', date: range }, attributes: ['userId', 'date'] }),
                SickLeaveRequest.findAll({ where: { userId: userIds, status: 'APPROVED', date: range }, attributes: ['userId', 'date'] }),
            ]);

            const attendanceSet = new Set(existingAttendance.map(a => `${a.userId}_${a.date}`));
            const wfaSet = new Set(approvedWfa.map(w => `${w.userId}_${w.date}`));
            const sickSet = new Set(approvedSick.map(s => `${s.userId}_${s.date}`));
            const leaveByUser = new Map();
            approvedLeaves.forEach(l => {
                if (!leaveByUser.has(l.userId)) leaveByUser.set(l.userId, []);
                leaveByUser.get(l.userId).push([l.startDate, l.endDate]);
            });
            const onApprovedLeave = (userId, date) => (leaveByUser.get(userId) || []).some(([s, e]) => date >= s && date <= e);

            const toCreate = [];
            for (const user of users) {
                for (const date of dates) {
                    const key = `${user.id}_${date}`;
                    if (attendanceSet.has(key) || wfaSet.has(key) || sickSet.has(key)) continue;
                    if (onApprovedLeave(user.id, date)) continue;
                    toCreate.push({
                        userId: user.id,
                        date,
                        shiftId: user.shiftId,
                        status: 'ABSENT',
                        workMode: 'ON_SITE',
                        note: 'Dibuat otomatis oleh sistem — tidak ada presensi tercatat',
                        editedBy: req.user.id,
                        editedAt: new Date(),
                        editReason: 'Backfill otomatis: tidak check-in dan tidak ada cuti/WFA/izin sakit disetujui',
                        companyId: user.companyId,
                    });
                }
            }

            if (toCreate.length) await Attendance.bulkCreate(toCreate);

            res.json({ created: toCreate.length, dates, checkedUsers: users.length });
        } catch (err) { next(err); }
    }

    static async pendingReview(req, res, next) {
        try {
            const { page, limit, offset } = paginate(req.query);

            const { rows, count } = await Attendance.findAndCountAll({
                where: {
                    ...companyFilter(req),
                    [Op.or]: [{ reviewStatus: 'PENDING_REVIEW' }, { lateExcuseStatus: 'PENDING_REVIEW' }],
                },
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

            // Reject klaim kerja lapangan berarti kehadiran hari itu nggak
            // tervalidasi — jangan biarkan tetap terhitung PRESENT di laporan.
            const statusPatch = (status === 'REJECTED' && attendance.status === 'PRESENT')
                ? { status: 'ABSENT' }
                : {};

            await attendance.update({
                ...statusPatch,
                reviewStatus: status,
                reviewedBy: req.user.id,
                reviewedAt: new Date(),
                reviewNote: reviewNote || null,
            });

            res.json(attendance);
        } catch (err) { next(err); }
    }

    // Self-service — karyawan nempelin alasan telat ke record presensinya
    // sendiri (kasus dadakan, gak sempat izin duluan). Cuma bisa sekali,
    // sebelum direview.
    static async submitLateReason(req, res, next) {
        try {
            const { reason } = req.body;
            if (!reason || !reason.trim()) throw { name: 'BadRequest', message: 'Alasan wajib diisi' };

            const attendance = await Attendance.findOne({ where: { id: req.params.id, userId: req.user.id, ...companyFilter(req) } });
            if (!attendance) throw { name: 'NotFound', message: 'Data absensi tidak ditemukan' };
            if (attendance.status !== 'LATE') throw { name: 'BadRequest', message: 'Hanya berlaku untuk presensi yang berstatus Terlambat' };
            if (attendance.lateExcuseStatus !== 'NONE') throw { name: 'BadRequest', message: 'Alasan keterlambatan sudah pernah diisi' };

            await attendance.update({ lateExcuseStatus: 'PENDING_REVIEW', lateExcuseReason: reason.trim() });
            res.json(attendance);
        } catch (err) { next(err); }
    }

    // Admin/superadmin review klaim telat dadakan. Approve -> dianggap tidak
    // telat sama sekali (status jadi PRESENT). Reject -> tetap LATE.
    static async reviewLate(req, res, next) {
        try {
            const { status, reviewNote } = req.body;
            if (!['APPROVED', 'REJECTED'].includes(status)) {
                throw { name: 'BadRequest', message: 'Status review harus APPROVED atau REJECTED' };
            }

            const attendance = await Attendance.findOne({ where: { id: req.params.id, ...companyFilter(req) } });
            if (!attendance) throw { name: 'NotFound', message: 'Data absensi tidak ditemukan' };
            if (attendance.lateExcuseStatus !== 'PENDING_REVIEW') {
                throw { name: 'BadRequest', message: 'Data ini tidak sedang menunggu review keterlambatan' };
            }

            await attendance.update({
                status: status === 'APPROVED' ? 'PRESENT' : attendance.status,
                lateExcuseStatus: status,
                lateExcuseReviewedBy: req.user.id,
                lateExcuseReviewedAt: new Date(),
                lateExcuseReviewNote: reviewNote || null,
            });

            res.json(attendance);
        } catch (err) { next(err); }
    }

    static async update(req, res, next) {
        try {
            const attendance = await Attendance.findOne({ where: { id: req.params.id, ...companyFilter(req) } });
            if (!attendance) throw { name: 'NotFound', message: 'Data absensi tidak ditemukan' };

            const { status, note, checkInAt, checkOutAt, workMode, editReason } = req.body;
            if (!editReason || !editReason.trim()) {
                throw { name: 'BadRequest', message: 'Alasan koreksi wajib diisi' };
            }
            if (workMode && !WORK_MODES.includes(workMode)) {
                throw { name: 'BadRequest', message: 'workMode tidak valid' };
            }

            const nextWorkMode = workMode ?? attendance.workMode;
            // Admin yang mengedit dianggap sudah memvalidasi sendiri — kalau
            // hasilnya FIELD, langsung disetujui, tidak perlu masuk antrean
            // review lagi.
            const reviewPatch = nextWorkMode === 'FIELD'
                ? { reviewStatus: 'APPROVED', reviewedBy: req.user.id, reviewedAt: new Date() }
                : {};

            await attendance.update({
                status:     status     ?? attendance.status,
                note:       note       ?? attendance.note,
                checkInAt:  checkInAt  ?? attendance.checkInAt,
                checkOutAt: checkOutAt ?? attendance.checkOutAt,
                workMode:   nextWorkMode,
                ...reviewPatch,
                editedBy:   req.user.id,
                editedAt:   new Date(),
                editReason: editReason.trim(),
            });

            res.json(attendance);
        } catch (err) { next(err); }
    }

    static async adminCreate(req, res, next) {
        try {
            const { userId, date, checkInAt, checkOutAt, status, workMode, note, editReason } = req.body;
            if (!userId || !date) {
                throw { name: 'BadRequest', message: 'userId dan date wajib diisi' };
            }
            if (!editReason || !editReason.trim()) {
                throw { name: 'BadRequest', message: 'Alasan wajib diisi' };
            }
            if (workMode && !WORK_MODES.includes(workMode)) {
                throw { name: 'BadRequest', message: 'workMode tidak valid' };
            }

            const user = await User.findOne({ where: { id: userId, ...companyFilter(req) } });
            if (!user) throw { name: 'NotFound', message: 'Pengguna tidak ditemukan' };

            const existing = await Attendance.findOne({ where: { userId, date } });
            if (existing) {
                throw { name: 'BadRequest', message: 'Data presensi untuk tanggal ini sudah ada, gunakan edit' };
            }

            const mode = workMode ?? 'ON_SITE';
            const reviewStatus = mode === 'FIELD' ? 'APPROVED' : 'NONE';

            const attendance = await Attendance.create({
                userId,
                date,
                shiftId: user.shiftId || null,
                checkInAt: checkInAt || null,
                checkOutAt: checkOutAt || null,
                status: status || 'PRESENT',
                workMode: mode,
                note: note || null,
                reviewStatus,
                reviewedBy: mode === 'FIELD' ? req.user.id : null,
                reviewedAt: mode === 'FIELD' ? new Date() : null,
                editedBy: req.user.id,
                editedAt: new Date(),
                editReason: editReason.trim(),
                companyId: companyId(req) ?? req.user.companyId,
            });

            res.status(201).json(attendance);
        } catch (err) { next(err); }
    }

    static async companyUsers(req, res, next) {
        try {
            const users = await User.findAll({
                where: { ...companyFilter(req), isActive: true },
                attributes: USER_ATTRS,
                order: [['name', 'ASC']],
            });
            res.json(users);
        } catch (err) { next(err); }
    }
}

module.exports = AttendanceController;
