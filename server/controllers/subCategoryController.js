'use strict';
const { SubCategory } = require('../models');
const { companyFilter, companyId } = require('../helpers/tenancy');
const { paginate, buildFilter, paginatedResponse } = require('../helpers/queryHelper');

class SubCategoryController {
    static async getAll(req, res, next) {
        try {
            const { page, limit, offset } = paginate(req.query);
            const filter = buildFilter(req.query, { name: 'like' });
            const { rows, count } = await SubCategory.findAndCountAll({
                where: { ...companyFilter(req), ...filter },
                order: [['name', 'ASC']],
                limit, offset
            });
            res.status(200).json(paginatedResponse(rows, count, page, limit));
        } catch (err) { next(err); }
    }

    static async getById(req, res, next) {
        try {
            const subCategory = await SubCategory.findOne({ where: { id: req.params.id, ...companyFilter(req) } });
            if (!subCategory) throw { name: 'NotFound', message: 'Sub Category not found' };
            res.status(200).json(subCategory);
        } catch (err) { next(err); }
    }

    static async create(req, res, next) {
        try {
            const subCategory = await SubCategory.create({ ...req.body, companyId: companyId(req) });
            res.status(201).json(subCategory);
        } catch (err) { next(err); }
    }

    static async update(req, res, next) {
        try {
            const subCategory = await SubCategory.findOne({ where: { id: req.params.id, ...companyFilter(req) } });
            if (!subCategory) throw { name: 'NotFound', message: 'Sub Category not found' };
            const { companyId: _c, ...safeBody } = req.body;
            await subCategory.update(safeBody);
            res.status(200).json(subCategory);
        } catch (err) { next(err); }
    }

    static async delete(req, res, next) {
        try {
            const subCategory = await SubCategory.findOne({ where: { id: req.params.id, ...companyFilter(req) } });
            if (!subCategory) throw { name: 'NotFound', message: 'Sub Category not found' };
            await subCategory.destroy();
            res.status(200).json({ message: 'Sub Category deleted successfully' });
        } catch (err) { next(err); }
    }
}

module.exports = SubCategoryController;
