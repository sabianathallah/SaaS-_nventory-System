'use strict';
const { Warehouse, sequelize } = require('../models');
const { companyFilter, companyId } = require('../helpers/tenancy');
const { paginate, buildFilter, paginatedResponse } = require('../helpers/queryHelper');

class WarehouseController {
    static async getAll(req, res, next) {
        try {
            const { page, limit, offset } = paginate(req.query);
            const filter = buildFilter(req.query, { name: 'like', location: 'like' });
            const { rows, count } = await Warehouse.findAndCountAll({
                where: { ...companyFilter(req), ...filter },
                attributes: {
                    include: [
                        [sequelize.literal(`(SELECT COUNT(DISTINCT "ProductId") FROM "Stocks" WHERE "WarehouseId" = "Warehouse"."id" AND quantity > 0)`), 'productCount'],
                        [sequelize.literal(`(SELECT COALESCE(SUM(quantity), 0) FROM "Stocks" WHERE "WarehouseId" = "Warehouse"."id")`), 'totalStock'],
                    ]
                },
                order: [['name', 'ASC']],
                limit, offset
            });
            res.status(200).json(paginatedResponse(rows, count, page, limit));
        } catch (err) { next(err); }
    }

    static async getById(req, res, next) {
        try {
            const warehouse = await Warehouse.findOne({ where: { id: req.params.id, ...companyFilter(req) } });
            if (!warehouse) throw { name: 'NotFound', message: 'Warehouse not found' };
            res.status(200).json(warehouse);
        } catch (err) { next(err); }
    }

    static async create(req, res, next) {
        try {
            const warehouse = await Warehouse.create({ ...req.body, companyId: companyId(req) });
            res.status(201).json(warehouse);
        } catch (err) { next(err); }
    }

    static async update(req, res, next) {
        try {
            const warehouse = await Warehouse.findOne({ where: { id: req.params.id, ...companyFilter(req) } });
            if (!warehouse) throw { name: 'NotFound', message: 'Warehouse not found' };
            await warehouse.update(req.body);
            res.status(200).json(warehouse);
        } catch (err) { next(err); }
    }

    static async delete(req, res, next) {
        try {
            const warehouse = await Warehouse.findOne({ where: { id: req.params.id, ...companyFilter(req) } });
            if (!warehouse) throw { name: 'NotFound', message: 'Warehouse not found' };
            await warehouse.destroy();
            res.status(200).json({ message: 'Warehouse deleted successfully' });
        } catch (err) { next(err); }
    }
}

module.exports = WarehouseController;
