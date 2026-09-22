'use strict';
const { SickLeaveRequest, User, sequelize } = require('../models');
const { companyFilter, companyId } = require('../helpers/tenancy');
const { paginate, buildFilter, paginatedResponse } = require('../helpers/queryHelper');
const { userHasPermission } = require('../helpers/permCheck');
const { todayDateOnly } = require('../helpers/timezone');

const USER_ATTRS = ['id', 'name', 'email', 'divisi', 'avatar'];

// Izin Sakit — laporan sakit di HARI ITU JUGA (tanggal selalu "hari ini",
// tidak bisa dipilih/diubah client, biar gak dipakai buat backdate). Alasan
// wajib diisi saat submit; surat sakit (foto) opsional dan boleh disusulkan
// lewat endpoint attachment terpisah.
class SickLeaveController {
    static async list(req, res, next) {
        try {
            const { page, limit, offset } = paginate(req.query);
            const filter = buildFilter(req.query, { status: 'exact' });

            const canViewAll = await userHasPermission(req, 'hris.attendance.review') || await userHasPermission(req, 'hris.reports.view');
            const selfFilter = canViewAll && req.query.userId ? { userId: req.query.userId } : (canViewAll ? {} : { userId: req.user.id });

            const { rows, count } = await SickLeaveRequest.findAndCountAll({
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
            const { reason } = req.body;
            if (!reason || !reason.trim()) throw { name: 'BadRequest', message: 'Alasan wajib diisi' };

            const date = todayDateOnly();
            const attachmentUrl = req.file?.path || null;

            const request = await sequelize.transaction(async (t) => {
                const existing = await SickLeaveRequest.findOne({
                    where: { userId: req.user.id, date, status: ['PENDING', 'APPROVED'] },
                    transaction: t,
                    lock: t.LOCK.UPDATE,
                });
                if (existing) throw { name: 'BadRequest', message: 'Sudah ada pengajuan izin sakit untuk hari ini' };

                return SickLeaveRequest.create({
                    userId: req.user.id,
                    date,
                    reason: reason.trim(),
                    attachmentUrl,
                    status: 'PENDING',
                    companyId: companyId(req) ?? req.user.companyId,
                }, { transaction: t });
            });
            res.status(201).json(request);
        } catch (err) {
            if (err.name === 'SequelizeUniqueConstraintError') {
                return res.status(400).json({ message: 'Sudah ada pengajuan izin sakit untuk hari ini' });
            }
            next(err);
        }
    }

    // Upload/ganti surat sakit belakangan — dipisah dari create() karena
    // suratnya boleh menyusul.
    static async attachProof(req, res, next) {
        try {
            const request = await SickLeaveRequest.findOne({ where: { id: req.params.id, userId: req.user.id, ...companyFilter(req) } });
            if (!request) throw { name: 'NotFound', message: 'Pengajuan izin sakit tidak ditemukan' };
            if (!req.file) throw { name: 'BadRequest', message: 'File surat sakit wajib diunggah' };
            await request.update({ attachmentUrl: req.file.path });
            res.json(request);
        } catch (err) { next(err); }
    }

    static async review(req, res, next) {
        try {
            const { status, reviewNote } = req.body;
            if (!['APPROVED', 'REJECTED'].includes(status)) {
                throw { name: 'BadRequest', message: 'Status harus APPROVED atau REJECTED' };
            }

            const request = await SickLeaveRequest.findOne({ where: { id: req.params.id, ...companyFilter(req) } });
            if (!request) throw { name: 'NotFound', message: 'Pengajuan izin sakit tidak ditemukan' };
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
            const request = await SickLeaveRequest.findOne({ where: { id: req.params.id, userId: req.user.id, ...companyFilter(req) } });
            if (!request) throw { name: 'NotFound', message: 'Pengajuan izin sakit tidak ditemukan' };
            if (request.status !== 'PENDING') throw { name: 'BadRequest', message: 'Hanya pengajuan PENDING yang bisa dibatalkan' };
            await request.update({ status: 'CANCELLED' });
            res.json(request);
        } catch (err) { next(err); }
    }
}

module.exports = SickLeaveController;
