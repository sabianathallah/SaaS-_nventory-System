'use strict';
const { SalaryProfile, User } = require('../models');
const { companyFilter, companyId } = require('../helpers/tenancy');

const USER_ATTRS = ['id', 'name', 'email', 'divisi', 'nik'];

// Profil gaji pokok per karyawan — diisi sekali, dipakai sebagai default
// tiap kali admin generate slip gaji bulanan (Fixed Salary & Tunjangan jarang
// berubah, beda dengan Overtime/Bonus/Potongan yang emang variatif tiap bulan).
class SalaryProfileController {
    static async list(req, res, next) {
        try {
            const users = await User.findAll({
                where: { isActive: true, ...companyFilter(req) },
                attributes: USER_ATTRS,
                include: [{ model: SalaryProfile, as: 'salaryProfile' }],
                order: [['name', 'ASC']],
            });
            res.json(users);
        } catch (err) { next(err); }
    }

    static async upsert(req, res, next) {
        try {
            const { userId, fixedSalary, allowanceTransport, allowanceMeal } = req.body;
            if (!userId) throw { name: 'BadRequest', message: 'userId wajib diisi' };

            const user = await User.findOne({ where: { id: userId, ...companyFilter(req) } });
            if (!user) throw { name: 'NotFound', message: 'Karyawan tidak ditemukan' };

            const [profile] = await SalaryProfile.findOrCreate({
                where: { userId },
                defaults: {
                    fixedSalary: fixedSalary || 0,
                    allowanceTransport: allowanceTransport || 0,
                    allowanceMeal: allowanceMeal || 0,
                    companyId: companyId(req) ?? user.companyId,
                },
            });
            await profile.update({
                fixedSalary: fixedSalary || 0,
                allowanceTransport: allowanceTransport || 0,
                allowanceMeal: allowanceMeal || 0,
            });
            res.json(profile);
        } catch (err) { next(err); }
    }
}

module.exports = SalaryProfileController;
