'use strict';
const { Stock_Opname_Item, Stock_Opname_Session, Product } = require('../models');
const { companyFilter } = require('../helpers/tenancy');
const { paginate, buildFilter, paginatedResponse } = require('../helpers/queryHelper');

class StockOpnameItemController {
    static async getAll(req, res, next) {
        try {
            const { page, limit, offset } = paginate(req.query);
            const filter = buildFilter(req.query, {
                SessionId:  'exact',
                ProductId:  'exact',
            });
            const { rows, count } = await Stock_Opname_Item.findAndCountAll({
                where: filter,
                include: [
                    { model: Stock_Opname_Session, attributes: ['id', 'status', 'started_at'], where: companyFilter(req), required: true },
                    { model: Product, attributes: ['id', 'name', 'sku'] }
                ],
                limit, offset,
                distinct: true
            });
            res.status(200).json(paginatedResponse(rows, count, page, limit));
        } catch (err) { next(err); }
    }

    static async getById(req, res, next) {
        try {
            const item = await Stock_Opname_Item.findByPk(req.params.id, {
                include: [
                    { model: Stock_Opname_Session, attributes: ['id', 'status', 'started_at'], where: companyFilter(req), required: true },
                    { model: Product, attributes: ['id', 'name', 'sku'] }
                ]
            });
            if (!item) throw { name: 'NotFound', message: 'Stock opname item not found' };
            res.status(200).json(item);
        } catch (err) { next(err); }
    }

    static async create(req, res, next) {
        try {
            const item = await Stock_Opname_Item.create(req.body);
            res.status(201).json(item);
        } catch (err) { next(err); }
    }

    static async update(req, res, next) {
        try {
            const item = await Stock_Opname_Item.findByPk(req.params.id, {
                include: [{ model: Stock_Opname_Session, where: companyFilter(req), required: true }]
            });
            if (!item) throw { name: 'NotFound', message: 'Stock opname item not found' };
            await item.update(req.body);
            res.status(200).json(item);
        } catch (err) { next(err); }
    }

    static async delete(req, res, next) {
        try {
            const item = await Stock_Opname_Item.findByPk(req.params.id, {
                include: [{ model: Stock_Opname_Session, where: companyFilter(req), required: true }]
            });
            if (!item) throw { name: 'NotFound', message: 'Stock opname item not found' };
            await item.destroy();
            res.status(200).json({ message: 'Stock opname item deleted successfully' });
        } catch (err) { next(err); }
    }
}

module.exports = StockOpnameItemController;
