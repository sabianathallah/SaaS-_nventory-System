'use strict';
const { Category } = require('../models');
const { companyFilter, companyId } = require('../helpers/tenancy');
const { paginate, buildFilter, paginatedResponse } = require('../helpers/queryHelper');

class CategoryController {
    static async getAll(req, res, next) {
        try {
            const { page, limit, offset } = paginate(req.query);
            const filter = buildFilter(req.query, { name: 'like' });
            const { rows, count } = await Category.findAndCountAll({
                where: { ...companyFilter(req), ...filter },
                order: [['name', 'ASC']],
                limit, offset
            });
            res.status(200).json(paginatedResponse(rows, count, page, limit));
        } catch (err) { next(err); }
    }

    static async getById(req, res, next) {
        try {
            const category = await Category.findOne({ where: { id: req.params.id, ...companyFilter(req) } });
            if (!category) throw { name: 'NotFound', message: 'Category not found' };
            res.status(200).json(category);
        } catch (err) { next(err); }
    }

    static async create(req, res, next) {
        try {
            const category = await Category.create({ ...req.body, companyId: companyId(req) });
            res.status(201).json(category);
        } catch (err) { next(err); }
    }

    static async update(req, res, next) {
        try {
            const category = await Category.findOne({ where: { id: req.params.id, ...companyFilter(req) } });
            if (!category) throw { name: 'NotFound', message: 'Category not found' };
            await category.update(req.body);
            res.status(200).json(category);
        } catch (err) { next(err); }
    }

    static async delete(req, res, next) {
        try {
            const category = await Category.findOne({ where: { id: req.params.id, ...companyFilter(req) } });
            if (!category) throw { name: 'NotFound', message: 'Category not found' };
            await category.destroy();
            res.status(200).json({ message: 'Category deleted successfully' });
        } catch (err) { next(err); }
    }
}

module.exports = CategoryController;
