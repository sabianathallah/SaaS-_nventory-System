'use strict';
const { User } = require('../models');
const { paginate, buildFilter, paginatedResponse } = require('../helpers/queryHelper');

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
                where: filter,
                attributes: { exclude: ['password'] },
                order: [['name', 'ASC']],
                limit, offset
            });
            res.status(200).json(paginatedResponse(rows, count, page, limit));
        } catch (err) { next(err); }
    }

    static async getById(req, res, next) {
        try {
            const user = await User.findByPk(req.params.id, { attributes: { exclude: ['password'] } });
            if (!user) throw { name: 'NotFound', message: 'User not found' };
            res.status(200).json(user);
        } catch (err) { next(err); }
    }

    static async create(req, res, next) {
        try {
            const user = await User.create(req.body);
            const { password, ...userWithoutPassword } = user.toJSON();
            res.status(201).json(userWithoutPassword);
        } catch (err) { next(err); }
    }

    static async update(req, res, next) {
        try {
            const user = await User.findByPk(req.params.id);
            if (!user) throw { name: 'NotFound', message: 'User not found' };
            await user.update(req.body);
            const { password, ...userWithoutPassword } = user.toJSON();
            res.status(200).json(userWithoutPassword);
        } catch (err) { next(err); }
    }

    static async delete(req, res, next) {
        try {
            const user = await User.findByPk(req.params.id);
            if (!user) throw { name: 'NotFound', message: 'User not found' };
            await user.destroy();
            res.status(200).json({ message: 'User deleted successfully' });
        } catch (err) { next(err); }
    }
}

module.exports = UserController;
