'use strict';
const { Stock, Product, Warehouse, ProductSKU } = require('../models');
const { companyFilter, companyId } = require('../helpers/tenancy');
const { paginate, buildFilter, paginatedResponse } = require('../helpers/queryHelper');

class StockController {
    static async getAll(req, res, next) {
        try {
            const { page, limit, offset } = paginate(req.query);
            const filter = buildFilter(req.query, {
                ProductId:   'exact',
                WarehouseId: 'exact',
            });
            const { rows, count } = await Stock.findAndCountAll({
                where: { ...companyFilter(req), ...filter },
                include: [
                    { model: Product,   attributes: ['id', 'name', 'sku'],
                      include: [{ model: ProductSKU, attributes: ['id', 'sku_code'], required: false }] },
                    { model: Warehouse, attributes: ['id', 'name'] }
                ],
                limit, offset,
                distinct: true
            });
            res.status(200).json(paginatedResponse(rows, count, page, limit));
        } catch (err) { next(err); }
    }

    static async getById(req, res, next) {
        try {
            const stock = await Stock.findOne({
                where: { id: req.params.id, ...companyFilter(req) },
                include: [
                    { model: Product,   attributes: ['id', 'name', 'sku'] },
                    { model: Warehouse, attributes: ['id', 'name'] }
                ]
            });
            if (!stock) throw { name: 'NotFound', message: 'Stock not found' };
            res.status(200).json(stock);
        } catch (err) { next(err); }
    }

    static async create(req, res, next) {
        try {
            const stock = await Stock.create({ ...req.body, companyId: companyId(req) });
            res.status(201).json(stock);
        } catch (err) { next(err); }
    }

    static async update(req, res, next) {
        try {
            const stock = await Stock.findOne({ where: { id: req.params.id, ...companyFilter(req) } });
            if (!stock) throw { name: 'NotFound', message: 'Stock not found' };
            await stock.update(req.body);
            res.status(200).json(stock);
        } catch (err) { next(err); }
    }

    static async delete(req, res, next) {
        try {
            const stock = await Stock.findOne({ where: { id: req.params.id, ...companyFilter(req) } });
            if (!stock) throw { name: 'NotFound', message: 'Stock not found' };
            await stock.destroy();
            res.status(200).json({ message: 'Stock deleted successfully' });
        } catch (err) { next(err); }
    }
}

module.exports = StockController;
