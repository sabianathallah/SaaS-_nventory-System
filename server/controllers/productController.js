'use strict';
const { Product, Category } = require('../models');
const { companyFilter, companyId } = require('../helpers/tenancy');
const { paginate, buildFilter, paginatedResponse } = require('../helpers/queryHelper');

class ProductController {
    static async getAll(req, res, next) {
        try {
            const { page, limit, offset } = paginate(req.query);
            const filter = buildFilter(req.query, {
                name:       'like',
                sku:        'like',
                CategoryId: 'exact',
            });
            const { rows, count } = await Product.findAndCountAll({
                where: { ...companyFilter(req), ...filter },
                include: [{ model: Category, attributes: ['id', 'name'] }],
                order: [['name', 'ASC']],
                limit, offset,
                distinct: true
            });
            res.status(200).json(paginatedResponse(rows, count, page, limit));
        } catch (err) { next(err); }
    }

    static async getById(req, res, next) {
        try {
            const product = await Product.findOne({
                where: { id: req.params.id, ...companyFilter(req) },
                include: [{ model: Category, attributes: ['id', 'name'] }]
            });
            if (!product) throw { name: 'NotFound', message: 'Product not found' };
            res.status(200).json(product);
        } catch (err) { next(err); }
    }

    static async create(req, res, next) {
        try {
            const product = await Product.create({ ...req.body, companyId: companyId(req) });
            res.status(201).json(product);
        } catch (err) { next(err); }
    }

    static async update(req, res, next) {
        try {
            const product = await Product.findOne({ where: { id: req.params.id, ...companyFilter(req) } });
            if (!product) throw { name: 'NotFound', message: 'Product not found' };
            await product.update(req.body);
            res.status(200).json(product);
        } catch (err) { next(err); }
    }

    static async delete(req, res, next) {
        try {
            const product = await Product.findOne({ where: { id: req.params.id, ...companyFilter(req) } });
            if (!product) throw { name: 'NotFound', message: 'Product not found' };
            await product.destroy();
            res.status(200).json({ message: 'Product deleted successfully' });
        } catch (err) { next(err); }
    }
}

module.exports = ProductController;
