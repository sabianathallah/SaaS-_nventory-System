'use strict';
const { User, Company, Role } = require('../models');
const { Op } = require('sequelize');
const { paginate, buildFilter, paginatedResponse } = require('../helpers/queryHelper');

const userCompanyFilter = (req) =>
    req.user?.role === 'SUPER_ADMIN' ? {} : { companyId: req.user?.companyId };

const normalizeDivisis = (input) => {
    const arr = Array.isArray(input) ? input : (input ? [input] : []);
    return [...new Set(arr.map(d => String(d).trim()).filter(Boolean))];
};

const USER_INCLUDE = [
    { model: Company, as: 'company', attributes: ['id', 'name', 'logo'], required: false },
];

async function attachRoleDisplayNames(users) {
    const roleNames = [...new Set(users.map(u => u.role).filter(Boolean))];
    if (!roleNames.length) return users;
    const roles = await Role.findAll({
        where: { name: { [Op.in]: roleNames }, companyId: null },
        attributes: ['name', 'displayName'],
    });
    const map = Object.fromEntries(roles.map(r => [r.name, r.displayName]));
    return users.map(u => ({
        ...u.toJSON(),
        roleDisplayName: map[u.role] ?? u.role,
    }));
}

class UserController {
    static async getAll(req, res, next) {
        try {
            const { page, limit, offset } = paginate(req.query);
            const filter = buildFilter(req.query, {
                role:      'exact',
                name:      'like',
                companyId: 'exact',
            });
            const { rows, count } = await User.findAndCountAll({
                where: { ...userCompanyFilter(req), ...filter },
                attributes: { exclude: ['password'] },
                include: USER_INCLUDE,
                order: [['name', 'ASC']],
                limit, offset
            });
            const enriched = await attachRoleDisplayNames(rows);
            res.status(200).json(paginatedResponse(enriched, count, page, limit));
        } catch (err) { next(err); }
    }

    static async getById(req, res, next) {
        try {
            const user = await User.findByPk(req.params.id, {
                attributes: { exclude: ['password'] },
                include: USER_INCLUDE,
            });
            if (!user) throw { name: 'NotFound', message: 'User not found' };
            const [enriched] = await attachRoleDisplayNames([user]);
            res.status(200).json(enriched);
        } catch (err) { next(err); }
    }

    static async create(req, res, next) {
        try {
            const payload = { ...req.body };
            if (payload.divisis !== undefined) {
                const divisis = normalizeDivisis(payload.divisis);
                payload.divisis = divisis;
                payload.divisi = divisis[0] || null;
            }
            const user = await User.create(payload);
            const { password, ...userWithoutPassword } = user.toJSON();
            res.status(201).json(userWithoutPassword);
        } catch (err) { next(err); }
    }

    static async update(req, res, next) {
        try {
            const user = await User.findOne({ where: { id: req.params.id, ...userCompanyFilter(req) } });
            if (!user) throw { name: 'NotFound', message: 'User not found' };
            const { name, email, role, avatar, password: newPassword, companyId: _c, ...rest } = req.body;
            const allowed = {};
            if (name      !== undefined) allowed.name   = name;
            if (email     !== undefined) allowed.email  = email;
            if (role      !== undefined) allowed.role   = role;
            if (avatar    !== undefined) allowed.avatar = avatar;
            if (newPassword) allowed.password = newPassword;
            if (req.body.divisis !== undefined) {
                const divisis = normalizeDivisis(req.body.divisis);
                allowed.divisis = divisis;
                allowed.divisi = divisis[0] || null;
            } else if (req.body.divisi !== undefined) {
                allowed.divisi = req.body.divisi?.trim() || null;
            }
            if (req.body.nik    !== undefined) allowed.nik    = req.body.nik?.trim() || null;
            await user.update(allowed);
            const { password, ...userWithoutPassword } = user.toJSON();
            res.status(200).json(userWithoutPassword);
        } catch (err) { next(err); }
    }

    static async delete(req, res, next) {
        try {
            const user = await User.findOne({ where: { id: req.params.id, ...userCompanyFilter(req) } });
            if (!user) throw { name: 'NotFound', message: 'User not found' };
            await user.destroy();
            res.status(200).json({ message: 'User deleted successfully' });
        } catch (err) { next(err); }
    }
}

module.exports = UserController;
