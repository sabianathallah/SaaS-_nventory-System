'use strict';
const { Op } = require('sequelize');
const { Attendance, Shift, OfficeLocation, User } = require('../models');
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
            const { lat, lng, note } = req.body;
            if (lat === undefined || lng === undefined) {
                throw { name: 'BadRequest', message: 'Lokasi (lat, lng) wajib diisi' };
            }

            const date = todayDateOnly();
            let attendance = await Attendance.findOne({ where: { userId: req.user.id, date } });
            if (attendance?.checkInAt) {
                throw { name: 'BadRequest', message: 'Anda sudah check-in hari ini' };
            }

            const location = await resolveOfficeLocation(req, lat, lng);

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
                checkInLocationId: location.id,
                status,
                note: note || null,
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
            const { lat, lng, note } = req.body;
            if (lat === undefined || lng === undefined) {
                throw { name: 'BadRequest', message: 'Lokasi (lat, lng) wajib diisi' };
            }

            const date = todayDateOnly();
            const attendance = await Attendance.findOne({ where: { userId: req.user.id, date } });
            if (!attendance || !attendance.checkInAt) {
                throw { name: 'BadRequest', message: 'Anda belum check-in hari ini' };
            }
            if (attendance.checkOutAt) {
                throw { name: 'BadRequest', message: 'Anda sudah check-out hari ini' };
            }

            const location = await resolveOfficeLocation(req, lat, lng);

            await attendance.update({
                checkOutAt: new Date(),
                checkOutLat: lat,
                checkOutLng: lng,
                checkOutLocationId: location.id,
                note: note || attendance.note,
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
