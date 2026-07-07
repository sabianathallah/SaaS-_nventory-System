'use strict';
const { LateExcuseRequest, User } = require('../models');
const { companyFilter, companyId } = require('../helpers/tenancy');
const { paginate, buildFilter, paginatedResponse } = require('../helpers/queryHelper');
const { userHasPermission } = require('../helpers/permCheck');
const { todayDateOnly } = require('../helpers/timezone');

const USER_ATTRS = ['id', 'name', 'email', 'divisi'];

// Izin Telat — pengajuan DI MUKA (sebelum check-in) untuk kasus yang sudah
// diketahui lebih dulu (mis. ke dokter pagi). Beda dengan klaim telat dadakan
// yang ditempel langsung ke record Attendance (lihat attendanceController).
class LateExcuseController {
    static async list(req, res, next) {
        try {
            const { page, limit, offset } = paginate(req.query);
            const filter = buildFilter(req.query, { status: 'exact' });

            const canViewAll = await userHasPermission(req, 'hris.attendance.review') || await userHasPermission(req, 'hris.reports.view');
            const selfFilter = canViewAll && req.query.userId ? { userId: req.query.userId } : (canViewAll ? {} : { userId: req.user.id });

            const { rows, count } = await LateExcuseRequest.findAndCountAll({
                where: { ...companyFilter(req), ...filter, ...selfFilter },
                include: [
                    { model: User, as: 'user', attributes: USER_ATTRS },
                    { model: User, as: 'reviewer', attributes: USER_ATTRS },
                ],
                order: [['date', 'DESC']],
                limit, offset,
                distinct: true,
            });
            res.json(paginatedResponse(rows, count, page, limit));
        } catch (err) { next(err); }
    }

    static async create(req, res, next) {
        try {
            const { date, expectedTime, reason } = req.body;
            if (!date) throw { name: 'BadRequest', message: 'date wajib diisi' };
            if (date < todayDateOnly()) throw { name: 'BadRequest', message: 'Tidak bisa mengajukan izin telat untuk tanggal yang sudah lewat' };
            if (!reason || !reason.trim()) throw { name: 'BadRequest', message: 'Alasan wajib diisi' };

            const existing = await LateExcuseRequest.findOne({
                where: { userId: req.user.id, date, status: ['PENDING', 'APPROVED'] },
            });
            if (existing) throw { name: 'BadRequest', message: 'Sudah ada pengajuan izin telat untuk tanggal ini' };

            const request = await LateExcuseRequest.create({
                userId: req.user.id,
                date,
                expectedTime: expectedTime || null,
                reason: reason.trim(),
                status: 'PENDING',
                companyId: companyId(req) ?? req.user.companyId,
            });
            res.status(201).json(request);
        } catch (err) { next(err); }
    }

    static async review(req, res, next) {
        try {
            const { status, reviewNote } = req.body;
            if (!['APPROVED', 'REJECTED'].includes(status)) {
                throw { name: 'BadRequest', message: 'Status harus APPROVED atau REJECTED' };
            }

            const request = await LateExcuseRequest.findOne({ where: { id: req.params.id, ...companyFilter(req) } });
            if (!request) throw { name: 'NotFound', message: 'Pengajuan izin telat tidak ditemukan' };
            if (request.status !== 'PENDING') throw { name: 'BadRequest', message: 'Pengajuan sudah direview' };

            await request.update({
                status,
                reviewedBy: req.user.id,
                reviewedAt: new Date(),
                reviewNote: reviewNote || null,
            });
            res.json(request);
        } catch (err) { next(err); }
    }

    static async cancel(req, res, next) {
        try {
            const request = await LateExcuseRequest.findOne({ where: { id: req.params.id, userId: req.user.id, ...companyFilter(req) } });
            if (!request) throw { name: 'NotFound', message: 'Pengajuan izin telat tidak ditemukan' };
            if (request.status !== 'PENDING') throw { name: 'BadRequest', message: 'Hanya pengajuan PENDING yang bisa dibatalkan' };
            await request.update({ status: 'CANCELLED' });
            res.json(request);
        } catch (err) { next(err); }
    }
}

module.exports = LateExcuseController;
