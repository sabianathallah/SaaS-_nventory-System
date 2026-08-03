'use strict';
const { LateExcuseRequest, User, Attendance, sequelize } = require('../models');
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

            const request = await sequelize.transaction(async (t) => {
                const existing = await LateExcuseRequest.findOne({
                    where: { userId: req.user.id, date, status: ['PENDING', 'APPROVED'] },
                    transaction: t,
                    lock: t.LOCK.UPDATE,
                });
                if (existing) throw { name: 'BadRequest', message: 'Sudah ada pengajuan izin telat untuk tanggal ini' };

                return LateExcuseRequest.create({
                    userId: req.user.id,
                    date,
                    expectedTime: expectedTime || null,
                    reason: reason.trim(),
                    status: 'PENDING',
                    companyId: companyId(req) ?? req.user.companyId,
                }, { transaction: t });
            });
            res.status(201).json(request);
        } catch (err) {
            if (err.name === 'SequelizeUniqueConstraintError') {
                return res.status(400).json({ message: 'Sudah ada pengajuan izin telat untuk tanggal ini' });
            }
            next(err);
        }
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

            // Kalau karyawan sudah keburu check-in (tercatat LATE) sebelum izin ini
            // di-review, reconcile record Attendance-nya sekarang — jangan biarkan
            // nyangkut LATE padahal izinnya sudah disetujui.
            if (status === 'APPROVED') {
                const attendance = await Attendance.findOne({
                    where: { userId: request.userId, date: request.date, status: 'LATE' },
                });
                if (attendance) {
                    await attendance.update({
                        status: 'PRESENT',
                        lateExcuseStatus: 'APPROVED',
                        lateExcuseReason: request.reason,
                        lateExcuseRequestId: request.id,
                        lateExcuseReviewedBy: request.reviewedBy,
                        lateExcuseReviewedAt: request.reviewedAt,
                    });
                }
            }

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
