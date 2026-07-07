'use strict';
const { LeaveType, LeaveBalance, LeaveRequest, User, sequelize } = require('../models');
const { companyFilter, companyId } = require('../helpers/tenancy');
const { paginate, buildFilter, paginatedResponse } = require('../helpers/queryHelper');
const { userHasPermission } = require('../helpers/permCheck');

const USER_ATTRS = ['id', 'name', 'email', 'divisi'];

function countDays(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffMs = end.getTime() - start.getTime();
    return Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
}

class LeaveController {
    static async listTypes(req, res, next) {
        try {
            const where = { ...companyFilter(req) };
            if (req.query.includeInactive !== 'true') where.isActive = true;
            const types = await LeaveType.findAll({ where, order: [['name', 'ASC']] });
            res.json(types);
        } catch (err) { next(err); }
    }

    static async createType(req, res, next) {
        try {
            const { name, maxDaysPerYear } = req.body;
            const type = await LeaveType.create({
                name,
                maxDaysPerYear: maxDaysPerYear || 12,
                isActive: true,
                companyId: companyId(req),
            });
            res.status(201).json(type);
        } catch (err) { next(err); }
    }

    static async updateType(req, res, next) {
        try {
            const type = await LeaveType.findOne({ where: { id: req.params.id, ...companyFilter(req) } });
            if (!type) throw { name: 'NotFound', message: 'Jenis cuti tidak ditemukan' };
            const { name, maxDaysPerYear, isActive } = req.body;
            await type.update({
                name: name ?? type.name,
                maxDaysPerYear: maxDaysPerYear ?? type.maxDaysPerYear,
                isActive: isActive ?? type.isActive,
            });
            res.json(type);
        } catch (err) { next(err); }
    }

    // Hard delete sengaja tidak dipakai dari UI — LeaveType.destroy() cascade
    // menghapus LeaveBalance & LeaveRequest historis (lihat asosiasi model).
    // "Hapus" jenis cuti dari UI cukup lewat updateType({ isActive: false }).
    static async deleteType(req, res, next) {
        try {
            const type = await LeaveType.findOne({ where: { id: req.params.id, ...companyFilter(req) } });
            if (!type) throw { name: 'NotFound', message: 'Jenis cuti tidak ditemukan' };
            await type.destroy();
            res.json({ message: 'Jenis cuti dihapus' });
        } catch (err) { next(err); }
    }

    static async getBalances(req, res, next) {
        try {
            const year = parseInt(req.query.year) || new Date().getFullYear();
            const userId = req.query.userId || req.user.id;

            const types = await LeaveType.findAll({ where: { ...companyFilter(req) } });
            const balances = await LeaveBalance.findAll({
                where: { userId, year, ...companyFilter(req) },
            });
            const byType = Object.fromEntries(balances.map(b => [b.leaveTypeId, b]));

            const result = types.map(t => {
                const bal = byType[t.id];
                const allocated = bal?.allocated ?? t.maxDaysPerYear;
                const used = bal?.used ?? 0;
                return {
                    leaveTypeId: t.id,
                    leaveTypeName: t.name,
                    allocated,
                    used,
                    remaining: allocated - used,
                };
            });
            res.json(result);
        } catch (err) { next(err); }
    }

    // Admin: semua user x saldo cuti untuk tahun tertentu (buat halaman adjust kuota)
    static async listBalancesForAdmin(req, res, next) {
        try {
            const year = parseInt(req.query.year) || new Date().getFullYear();

            const users = await User.findAll({
                where: { ...companyFilter(req), isActive: true },
                attributes: ['id', 'name', 'email', 'divisi'],
                order: [['name', 'ASC']],
            });
            const types = await LeaveType.findAll({ where: { ...companyFilter(req) }, order: [['name', 'ASC']] });
            const balances = await LeaveBalance.findAll({ where: { year, ...companyFilter(req) } });

            const byUserType = {};
            balances.forEach(b => { byUserType[`${b.userId}:${b.leaveTypeId}`] = b; });

            const result = users.map(u => ({
                userId: u.id,
                userName: u.name,
                divisi: u.divisi,
                balances: types.map(t => {
                    const bal = byUserType[`${u.id}:${t.id}`];
                    const allocated = bal?.allocated ?? t.maxDaysPerYear;
                    const used = bal?.used ?? 0;
                    return { leaveTypeId: t.id, leaveTypeName: t.name, allocated, used, remaining: allocated - used };
                }),
            }));
            res.json({ year, types, users: result });
        } catch (err) { next(err); }
    }

    // Admin: set allocated kuota cuti untuk 1 user + 1 jenis cuti + tahun tertentu
    static async adjustBalance(req, res, next) {
        try {
            const { userId, leaveTypeId, year, allocated } = req.body;
            if (!userId || !leaveTypeId || !year || allocated === undefined) {
                throw { name: 'BadRequest', message: 'userId, leaveTypeId, year, dan allocated wajib diisi' };
            }
            if (Number(allocated) < 0) throw { name: 'BadRequest', message: 'allocated tidak boleh negatif' };

            const user = await User.findOne({ where: { id: userId, ...companyFilter(req) } });
            if (!user) throw { name: 'NotFound', message: 'User tidak ditemukan' };
            const leaveType = await LeaveType.findOne({ where: { id: leaveTypeId, ...companyFilter(req) } });
            if (!leaveType) throw { name: 'NotFound', message: 'Jenis cuti tidak ditemukan' };

            const [balance, created] = await LeaveBalance.findOrCreate({
                where: { userId, leaveTypeId, year },
                defaults: { allocated: Number(allocated), used: 0, companyId: companyId(req) ?? user.companyId },
            });
            if (!created) await balance.update({ allocated: Number(allocated) });

            res.json(balance);
        } catch (err) { next(err); }
    }

    static async list(req, res, next) {
        try {
            const { page, limit, offset } = paginate(req.query);
            const filter = buildFilter(req.query, { status: 'exact', leaveTypeId: 'exact' });

            const canViewAll = await userHasPermission(req, 'hris.leave.review') || await userHasPermission(req, 'hris.reports.view');
            const selfFilter = canViewAll && req.query.userId ? { userId: req.query.userId } : (canViewAll ? {} : { userId: req.user.id });

            const { rows, count } = await LeaveRequest.findAndCountAll({
                where: { ...companyFilter(req), ...filter, ...selfFilter },
                include: [
                    { model: User, as: 'user', attributes: USER_ATTRS },
                    { model: LeaveType, as: 'leaveType' },
                    { model: User, as: 'reviewer', attributes: USER_ATTRS },
                ],
                order: [['createdAt', 'DESC']],
                limit, offset,
                distinct: true,
            });
            res.json(paginatedResponse(rows, count, page, limit));
        } catch (err) { next(err); }
    }

    static async create(req, res, next) {
        try {
            const { leaveTypeId, startDate, endDate, reason } = req.body;
            if (!leaveTypeId || !startDate || !endDate) {
                throw { name: 'BadRequest', message: 'leaveTypeId, startDate, dan endDate wajib diisi' };
            }
            const days = countDays(startDate, endDate);
            if (days <= 0) throw { name: 'BadRequest', message: 'endDate harus setelah atau sama dengan startDate' };

            const leaveType = await LeaveType.findOne({ where: { id: leaveTypeId, ...companyFilter(req) } });
            if (!leaveType) throw { name: 'NotFound', message: 'Jenis cuti tidak ditemukan' };

            const year = new Date(startDate).getFullYear();
            const balance = await LeaveBalance.findOne({ where: { userId: req.user.id, leaveTypeId, year } });
            const allocated = balance?.allocated ?? leaveType.maxDaysPerYear;
            const used = balance?.used ?? 0;
            if (used + days > allocated) {
                throw { name: 'BadRequest', message: `Sisa saldo cuti tidak cukup (sisa ${allocated - used} hari)` };
            }

            const request = await LeaveRequest.create({
                userId: req.user.id,
                leaveTypeId,
                startDate,
                endDate,
                days,
                reason: reason || null,
                status: 'PENDING',
                companyId: companyId(req) ?? req.user.companyId,
            });
            res.status(201).json(request);
        } catch (err) { next(err); }
    }

    static async review(req, res, next) {
        const t = await sequelize.transaction();
        try {
            const { status, reviewNote } = req.body;
            if (!['APPROVED', 'REJECTED'].includes(status)) {
                throw { name: 'BadRequest', message: 'Status harus APPROVED atau REJECTED' };
            }

            const request = await LeaveRequest.findOne({ where: { id: req.params.id, ...companyFilter(req) }, transaction: t });
            if (!request) throw { name: 'NotFound', message: 'Pengajuan cuti tidak ditemukan' };
            if (request.status !== 'PENDING') {
                throw { name: 'BadRequest', message: 'Pengajuan sudah direview' };
            }

            await request.update({
                status,
                reviewedBy: req.user.id,
                reviewedAt: new Date(),
                reviewNote: reviewNote || null,
            }, { transaction: t });

            if (status === 'APPROVED') {
                const year = new Date(request.startDate).getFullYear();
                const [balance] = await LeaveBalance.findOrCreate({
                    where: { userId: request.userId, leaveTypeId: request.leaveTypeId, year },
                    defaults: { allocated: (await LeaveType.findByPk(request.leaveTypeId)).maxDaysPerYear, used: 0, companyId: request.companyId },
                    transaction: t,
                });
                await balance.increment('used', { by: request.days, transaction: t });
            }

            await t.commit();
            res.json(request);
        } catch (err) { await t.rollback(); next(err); }
    }

    static async cancel(req, res, next) {
        try {
            const request = await LeaveRequest.findOne({ where: { id: req.params.id, userId: req.user.id, ...companyFilter(req) } });
            if (!request) throw { name: 'NotFound', message: 'Pengajuan cuti tidak ditemukan' };
            if (request.status !== 'PENDING') {
                throw { name: 'BadRequest', message: 'Hanya pengajuan PENDING yang bisa dibatalkan' };
            }
            await request.update({ status: 'CANCELLED' });
            res.json(request);
        } catch (err) { next(err); }
    }
}

module.exports = LeaveController;
