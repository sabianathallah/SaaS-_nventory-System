'use strict';
const { WfaSetting, WfaQuota, WfaRequest, PaymentAdjustment, User, sequelize } = require('../models');
const { companyFilter, companyId } = require('../helpers/tenancy');
const { paginate, buildFilter, paginatedResponse } = require('../helpers/queryHelper');
const { userHasPermission } = require('../helpers/permCheck');
const { todayDateOnly } = require('../helpers/timezone');

const USER_ATTRS = ['id', 'name', 'email', 'divisi'];
const DEFAULT_QUOTA = 4;

async function getDefaultQuota(req) {
    const setting = await WfaSetting.findOne({ where: { ...companyFilter(req) } });
    return setting?.defaultMonthlyQuota ?? DEFAULT_QUOTA;
}

async function getQuotaForUser(req, userId, month, year) {
    const quota = await WfaQuota.findOne({ where: { userId, month, year } });
    if (quota) return { allocated: quota.allocated, used: quota.used, quota };
    const allocated = await getDefaultQuota(req);
    return { allocated, used: 0, quota: null };
}

class WfaController {
    static async getSettings(req, res, next) {
        try {
            const setting = await WfaSetting.findOne({ where: { ...companyFilter(req) } });
            res.json({ defaultMonthlyQuota: setting?.defaultMonthlyQuota ?? DEFAULT_QUOTA });
        } catch (err) { next(err); }
    }

    static async updateSettings(req, res, next) {
        try {
            const { defaultMonthlyQuota } = req.body;
            if (defaultMonthlyQuota === undefined || Number(defaultMonthlyQuota) < 0) {
                throw { name: 'BadRequest', message: 'defaultMonthlyQuota wajib diisi dan tidak boleh negatif' };
            }
            const cid = companyId(req);
            const [setting] = await WfaSetting.findOrCreate({
                where: { companyId: cid },
                defaults: { companyId: cid, defaultMonthlyQuota: Number(defaultMonthlyQuota) },
            });
            await setting.update({ defaultMonthlyQuota: Number(defaultMonthlyQuota) });
            res.json(setting);
        } catch (err) { next(err); }
    }

    static async getMyQuota(req, res, next) {
        try {
            const month = parseInt(req.query.month) || (new Date().getMonth() + 1);
            const year = parseInt(req.query.year) || new Date().getFullYear();
            const canViewAll = await userHasPermission(req, 'hris.wfa.review') || await userHasPermission(req, 'hris.reports.view');
            const userId = canViewAll && req.query.userId ? req.query.userId : req.user.id;
            const { allocated, used } = await getQuotaForUser(req, userId, month, year);
            res.json({ month, year, allocated, used, remaining: allocated - used });
        } catch (err) { next(err); }
    }

    // Admin: semua user x kuota WFA untuk bulan/tahun tertentu
    static async listQuotasForAdmin(req, res, next) {
        try {
            const month = parseInt(req.query.month) || (new Date().getMonth() + 1);
            const year = parseInt(req.query.year) || new Date().getFullYear();
            const defaultQuota = await getDefaultQuota(req);

            const users = await User.findAll({
                where: { ...companyFilter(req), isActive: true },
                attributes: ['id', 'name', 'email', 'divisi'],
                order: [['name', 'ASC']],
            });
            const quotas = await WfaQuota.findAll({ where: { month, year, ...companyFilter(req) } });
            const byUser = Object.fromEntries(quotas.map(q => [q.userId, q]));

            const result = users.map(u => {
                const q = byUser[u.id];
                const allocated = q?.allocated ?? defaultQuota;
                const used = q?.used ?? 0;
                return { userId: u.id, userName: u.name, divisi: u.divisi, allocated, used, remaining: allocated - used };
            });
            res.json({ month, year, defaultMonthlyQuota: defaultQuota, users: result });
        } catch (err) { next(err); }
    }

    // Admin: set allocated kuota WFA untuk 1 user + bulan + tahun tertentu
    static async adjustQuota(req, res, next) {
        try {
            const { userId, month, year, allocated } = req.body;
            if (!userId || !month || !year || allocated === undefined) {
                throw { name: 'BadRequest', message: 'userId, month, year, dan allocated wajib diisi' };
            }
            if (Number(allocated) < 0) throw { name: 'BadRequest', message: 'allocated tidak boleh negatif' };

            const user = await User.findOne({ where: { id: userId, ...companyFilter(req) } });
            if (!user) throw { name: 'NotFound', message: 'User tidak ditemukan' };

            const [quota, created] = await WfaQuota.findOrCreate({
                where: { userId, month, year },
                defaults: { allocated: Number(allocated), used: 0, companyId: companyId(req) ?? user.companyId },
            });
            if (!created) await quota.update({ allocated: Number(allocated) });
            res.json(quota);
        } catch (err) { next(err); }
    }

    static async list(req, res, next) {
        try {
            const { page, limit, offset } = paginate(req.query);
            const filter = buildFilter(req.query, { status: 'exact' });

            const canViewAll = await userHasPermission(req, 'hris.wfa.review') || await userHasPermission(req, 'hris.reports.view');
            const selfFilter = canViewAll && req.query.userId ? { userId: req.query.userId } : (canViewAll ? {} : { userId: req.user.id });

            const { rows, count } = await WfaRequest.findAndCountAll({
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
            const { date, reason } = req.body;
            if (!date) throw { name: 'BadRequest', message: 'date wajib diisi' };
            if (date < todayDateOnly()) throw { name: 'BadRequest', message: 'Tidak bisa mengajukan WFA untuk tanggal yang sudah lewat' };

            const existing = await WfaRequest.findOne({
                where: { userId: req.user.id, date, status: ['PENDING', 'APPROVED'] },
            });
            if (existing) throw { name: 'BadRequest', message: 'Sudah ada pengajuan WFA untuk tanggal ini' };

            const [year, month] = date.split('-').map(Number);
            const { allocated, used } = await getQuotaForUser(req, req.user.id, month, year);
            const isOverQuota = used >= allocated;

            const request = await WfaRequest.create({
                userId: req.user.id,
                date,
                reason: reason || null,
                isOverQuota,
                status: 'PENDING',
                companyId: companyId(req) ?? req.user.companyId,
            });
            res.status(201).json(request);
        } catch (err) {
            if (err.name === 'SequelizeUniqueConstraintError') {
                return res.status(400).json({ message: 'Sudah ada pengajuan WFA untuk tanggal ini' });
            }
            next(err);
        }
    }

    static async review(req, res, next) {
        const t = await sequelize.transaction();
        try {
            const { status, reviewNote, adjustmentAmount, adjustmentNote } = req.body;
            if (!['APPROVED', 'REJECTED'].includes(status)) {
                throw { name: 'BadRequest', message: 'Status harus APPROVED atau REJECTED' };
            }

            const request = await WfaRequest.findOne({
                where: { id: req.params.id, ...companyFilter(req) },
                transaction: t,
                lock: t.LOCK.UPDATE,
            });
            if (!request) throw { name: 'NotFound', message: 'Pengajuan WFA tidak ditemukan' };
            if (request.status !== 'PENDING') throw { name: 'BadRequest', message: 'Pengajuan sudah direview' };

            await request.update({
                status,
                reviewedBy: req.user.id,
                reviewedAt: new Date(),
                reviewNote: reviewNote || null,
            }, { transaction: t });

            if (status === 'APPROVED') {
                const [year, month] = request.date.split('-').map(Number);
                const defaultQuota = await getDefaultQuota(req);
                const [quota] = await WfaQuota.findOrCreate({
                    where: { userId: request.userId, month, year },
                    defaults: { allocated: defaultQuota, used: 0, companyId: request.companyId },
                    transaction: t,
                    lock: t.LOCK.UPDATE,
                });

                // Re-cek over-kuota berdasarkan pemakaian riil saat approval (bisa
                // berubah dari saat pengajuan dibuat kalau ada pengajuan lain yang
                // sudah lebih dulu di-approve di bulan yang sama).
                const isOverQuota = quota.used >= quota.allocated;
                await quota.increment('used', { by: 1, transaction: t });
                if (isOverQuota !== request.isOverQuota) {
                    await request.update({ isOverQuota }, { transaction: t });
                }

                if (isOverQuota && adjustmentAmount !== undefined && Number(adjustmentAmount) > 0) {
                    await PaymentAdjustment.create({
                        userId: request.userId,
                        wfaRequestId: request.id,
                        type: 'WFA_OVERQUOTA',
                        month, year,
                        amount: Number(adjustmentAmount),
                        note: adjustmentNote || null,
                        createdBy: req.user.id,
                        companyId: request.companyId,
                    }, { transaction: t });
                }
            }

            await t.commit();
            res.json(request);
        } catch (err) { await t.rollback(); next(err); }
    }

    static async cancel(req, res, next) {
        try {
            const request = await WfaRequest.findOne({ where: { id: req.params.id, userId: req.user.id, ...companyFilter(req) } });
            if (!request) throw { name: 'NotFound', message: 'Pengajuan WFA tidak ditemukan' };
            if (request.status !== 'PENDING') throw { name: 'BadRequest', message: 'Hanya pengajuan PENDING yang bisa dibatalkan' };
            await request.update({ status: 'CANCELLED' });
            res.json(request);
        } catch (err) { next(err); }
    }

    static async listPaymentAdjustments(req, res, next) {
        try {
            const { page, limit, offset } = paginate(req.query);
            const filter = buildFilter(req.query, { month: 'exact', year: 'exact', userId: 'exact' });

            const { rows, count } = await PaymentAdjustment.findAndCountAll({
                where: { ...companyFilter(req), ...filter },
                include: [
                    { model: User, as: 'user', attributes: USER_ATTRS },
                    { model: User, as: 'creator', attributes: USER_ATTRS },
                    { model: WfaRequest, as: 'wfaRequest' },
                ],
                order: [['createdAt', 'DESC']],
                limit, offset,
                distinct: true,
            });
            res.json(paginatedResponse(rows, count, page, limit));
        } catch (err) { next(err); }
    }
}

module.exports = WfaController;
