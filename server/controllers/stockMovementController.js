'use strict';
const { Stock_Movement, Product, Warehouse } = require('../models');
const { companyFilter, companyId } = require('../helpers/tenancy');
const { paginate, buildFilter, paginatedResponse } = require('../helpers/queryHelper');

class StockMovementController {
    static async getAll(req, res, next) {
        try {
            const { page, limit, offset } = paginate(req.query);
            const filter = buildFilter(req.query, {
                type:        'exact',
                ProductId:   'exact',
                WarehouseId: 'exact',
                dateFrom:    { field: 'createdAt', type: 'gte' },
                dateTo:      { field: 'createdAt', type: 'lte' },
            });
            const { rows, count } = await Stock_Movement.findAndCountAll({
                where: { ...companyFilter(req), ...filter },
                include: [
                    { model: Product,   attributes: ['id', 'name', 'sku'] },
                    { model: Warehouse, attributes: ['id', 'name'] }
                ],
                order: [['createdAt', 'DESC']],
                limit, offset,
                distinct: true
            });
            res.status(200).json(paginatedResponse(rows, count, page, limit));
        } catch (err) { next(err); }
    }

    static async getById(req, res, next) {
        try {
            const movement = await Stock_Movement.findOne({
                where: { id: req.params.id, ...companyFilter(req) },
                include: [
                    { model: Product,   attributes: ['id', 'name', 'sku'] },
                    { model: Warehouse, attributes: ['id', 'name'] }
                ]
            });
            if (!movement) throw { name: 'NotFound', message: 'Stock movement not found' };
            res.status(200).json(movement);
        } catch (err) { next(err); }
    }

    static async create(req, res, next) {
        try {
            const movement = await Stock_Movement.create({ ...req.body, companyId: companyId(req) });
            res.status(201).json(movement);
        } catch (err) { next(err); }
    }

    static async delete(req, res, next) {
        try {
            const movement = await Stock_Movement.findOne({ where: { id: req.params.id, ...companyFilter(req) } });
            if (!movement) throw { name: 'NotFound', message: 'Stock movement not found' };
            await movement.destroy();
            res.status(200).json({ message: 'Stock movement deleted successfully' });
        } catch (err) { next(err); }
    }
}

module.exports = StockMovementController;
