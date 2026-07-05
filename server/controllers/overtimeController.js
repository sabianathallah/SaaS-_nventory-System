'use strict';
const { OvertimeRequest, Attendance, User } = require('../models');
const { companyFilter, companyId } = require('../helpers/tenancy');
const { paginate, buildFilter, paginatedResponse } = require('../helpers/queryHelper');
const { userHasPermission } = require('../helpers/permCheck');

const USER_ATTRS = ['id', 'name', 'email', 'divisi'];

class OvertimeController {
    static async list(req, res, next) {
        try {
            const { page, limit, offset } = paginate(req.query);
            const filter = buildFilter(req.query, { status: 'exact' });

            const canViewAll = await userHasPermission(req, 'hris.overtime.review') || await userHasPermission(req, 'hris.reports.view');
            const selfFilter = canViewAll && req.query.userId ? { userId: req.query.userId } : (canViewAll ? {} : { userId: req.user.id });

            const { rows, count } = await OvertimeRequest.findAndCountAll({
                where: { ...companyFilter(req), ...filter, ...selfFilter },
                include: [
                    { model: User, as: 'user', attributes: USER_ATTRS },
                    { model: User, as: 'reviewer', attributes: USER_ATTRS },
                    { model: Attendance, as: 'attendance' },
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
            const { date, startTime, endTime, reason, attendanceId } = req.body;
            if (!date || !startTime || !endTime) {
                throw { name: 'BadRequest', message: 'date, startTime, dan endTime wajib diisi' };
            }
            if (startTime >= endTime) {
                throw { name: 'BadRequest', message: 'endTime harus setelah startTime' };
            }

            const request = await OvertimeRequest.create({
                userId: req.user.id,
                attendanceId: attendanceId || null,
                date,
                startTime,
                endTime,
                reason: reason || null,
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
            const request = await OvertimeRequest.findOne({ where: { id: req.params.id, ...companyFilter(req) } });
            if (!request) throw { name: 'NotFound', message: 'Pengajuan lembur tidak ditemukan' };
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
            const request = await OvertimeRequest.findOne({ where: { id: req.params.id, userId: req.user.id, ...companyFilter(req) } });
            if (!request) throw { name: 'NotFound', message: 'Pengajuan lembur tidak ditemukan' };
            if (request.status !== 'PENDING') throw { name: 'BadRequest', message: 'Hanya pengajuan PENDING yang bisa dibatalkan' };
            await request.update({ status: 'CANCELLED' });
            res.json(request);
        } catch (err) { next(err); }
    }
}

module.exports = OvertimeController;
