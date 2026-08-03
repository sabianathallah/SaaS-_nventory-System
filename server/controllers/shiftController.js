'use strict';
const { Shift, User } = require('../models');
const { companyFilter, companyId } = require('../helpers/tenancy');

class ShiftController {
    static async list(req, res, next) {
        try {
            const shifts = await Shift.findAll({ where: { ...companyFilter(req) }, order: [['startTime', 'ASC']] });
            res.json(shifts);
        } catch (err) { next(err); }
    }

    static async create(req, res, next) {
        try {
            const { name, startTime, endTime } = req.body;
            if (!name || !startTime || !endTime) {
                throw { name: 'BadRequest', message: 'name, startTime, dan endTime wajib diisi' };
            }
            if (startTime >= endTime) {
                throw { name: 'BadRequest', message: 'Jam mulai harus lebih awal dari jam selesai' };
            }
            const shift = await Shift.create({ name, startTime, endTime, companyId: companyId(req) });
            res.status(201).json(shift);
        } catch (err) { next(err); }
    }

    static async update(req, res, next) {
        try {
            const shift = await Shift.findOne({ where: { id: req.params.id, ...companyFilter(req) } });
            if (!shift) throw { name: 'NotFound', message: 'Shift tidak ditemukan' };
            const { name, startTime, endTime } = req.body;
            const nextStart = startTime ?? shift.startTime;
            const nextEnd   = endTime ?? shift.endTime;
            if (nextStart >= nextEnd) {
                throw { name: 'BadRequest', message: 'Jam mulai harus lebih awal dari jam selesai' };
            }
            await shift.update({
                name: name ?? shift.name,
                startTime: nextStart,
                endTime: nextEnd,
            });
            res.json(shift);
        } catch (err) { next(err); }
    }

    static async destroy(req, res, next) {
        try {
            const shift = await Shift.findOne({ where: { id: req.params.id, ...companyFilter(req) } });
            if (!shift) throw { name: 'NotFound', message: 'Shift tidak ditemukan' };
            const usersCount = await User.count({ where: { shiftId: shift.id } });
            if (usersCount > 0) {
                throw { name: 'BadRequest', message: `Shift masih dipakai oleh ${usersCount} karyawan — pindahkan mereka ke shift lain dulu sebelum menghapus` };
            }
            await shift.destroy();
            res.json({ message: 'Shift dihapus' });
        } catch (err) { next(err); }
    }

    static async assign(req, res, next) {
        try {
            const { userId, shiftId } = req.body;
            if (!userId) throw { name: 'BadRequest', message: 'userId wajib diisi' };

            const user = await User.findOne({ where: { id: userId, ...companyFilter(req) } });
            if (!user) throw { name: 'NotFound', message: 'User tidak ditemukan' };

            if (shiftId) {
                const shift = await Shift.findOne({ where: { id: shiftId, ...companyFilter(req) } });
                if (!shift) throw { name: 'NotFound', message: 'Shift tidak ditemukan' };
            }

            await user.update({ shiftId: shiftId || null });
            res.json({ message: 'Shift berhasil ditetapkan', userId: user.id, shiftId: user.shiftId });
        } catch (err) { next(err); }
    }

    static async listUsers(req, res, next) {
        try {
            const users = await User.findAll({
                where: { ...companyFilter(req), isActive: true },
                attributes: ['id', 'name', 'email', 'divisi', 'role', 'shiftId'],
                include: [{ model: Shift, as: 'shift' }],
                order: [['name', 'ASC']],
            });
            res.json(users);
        } catch (err) { next(err); }
    }
}

module.exports = ShiftController;
