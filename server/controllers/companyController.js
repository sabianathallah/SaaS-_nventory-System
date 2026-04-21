'use strict';
const { Company, User } = require('../models');
const { paginate, buildFilter, paginatedResponse } = require('../helpers/queryHelper');

class CompanyController {
    static async getAll(req, res, next) {
        try {
            const { page, limit, offset } = paginate(req.query);
            const filter = buildFilter(req.query, {
                name:   'like',
                status: 'exact',
            });
            const { rows, count } = await Company.findAndCountAll({
                where: filter,
                order: [['name', 'ASC']],
                limit, offset
            });
            res.status(200).json(paginatedResponse(rows, count, page, limit));
        } catch (err) { next(err); }
    }

    static async getById(req, res, next) {
        try {
            const company = await Company.findByPk(req.params.id, {
                include: [{ model: User, attributes: ['id', 'name', 'email', 'role', 'isActive'] }]
            });
            if (!company) throw { name: 'NotFound', message: 'Company not found' };
            res.status(200).json(company);
        } catch (err) { next(err); }
    }

    static async create(req, res, next) {
        try {
            const company = await Company.create(req.body);
            res.status(201).json(company);
        } catch (err) { next(err); }
    }

    static async update(req, res, next) {
        try {
            const company = await Company.findByPk(req.params.id);
            if (!company) throw { name: 'NotFound', message: 'Company not found' };
            await company.update(req.body);
            res.status(200).json(company);
        } catch (err) { next(err); }
    }

    static async delete(req, res, next) {
        try {
            const company = await Company.findByPk(req.params.id);
            if (!company) throw { name: 'NotFound', message: 'Company not found' };
            await company.destroy();
            res.status(200).json({ message: 'Company deleted successfully' });
        } catch (err) { next(err); }
    }
}

module.exports = CompanyController;
