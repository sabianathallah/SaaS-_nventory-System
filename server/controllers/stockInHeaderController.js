'use strict';
const { sequelize, Stock_In_Header, Stock_Movement, Stock, Supplier, Product, Warehouse } = require('../models');
const { companyFilter, companyId } = require('../helpers/tenancy');
const { paginate, buildFilter, paginatedResponse } = require('../helpers/queryHelper');

class StockInHeaderController {
    static async getAll(req, res, next) {
        try {
            const { page, limit, offset } = paginate(req.query);
            const filter = buildFilter(req.query, {
                SupplierId: 'exact',
                dateFrom:   { field: 'date', type: 'gte' },
                dateTo:     { field: 'date', type: 'lte' },
            });
            const { rows, count } = await Stock_In_Header.findAndCountAll({
                where: { ...companyFilter(req), ...filter },
                include: [
                    { model: Supplier,  attributes: ['id', 'name'] },
                    { model: Warehouse, attributes: ['id', 'name'] },
                ],
                order: [['date', 'DESC']],
                limit, offset,
                distinct: true
            });
            res.status(200).json(paginatedResponse(rows, count, page, limit));
        } catch (err) { next(err); }
    }

    static async getById(req, res, next) {
        try {
            const header = await Stock_In_Header.findOne({
                where: { id: req.params.id, ...companyFilter(req) },
                include: [
                    { model: Supplier,  attributes: ['id', 'name'] },
                    { model: Warehouse, attributes: ['id', 'name'] },
                ]
            });
            if (!header) throw { name: 'NotFound', message: 'Stock in header not found' };
            const movements = await Stock_Movement.findAll({
                where: { ReferenceId: header.id, type: 'IN', ...companyFilter(req) },
                include: [
                    { model: Product,   attributes: ['id', 'name', 'sku', 'unit'] },
                    { model: Warehouse, attributes: ['id', 'name'] }
                ]
            });
            res.status(200).json({ ...header.toJSON(), movements });
        } catch (err) { next(err); }
    }

    static async create(req, res, next) {
        const t = await sequelize.transaction();
        try {
            const { items = [], ...headerData } = req.body;
            const cid = companyId(req);
            if (!items.length) { await t.rollback(); return res.status(400).json({ message: 'Items tidak boleh kosong' }); }

            // Header-level WarehouseId is the single source of truth for FE; fall
            // back to the first item's WarehouseId if caller sent it per-item.
            const headerWhId = headerData.WarehouseId || items.find(i => i.WarehouseId)?.WarehouseId || null;
            if (!headerWhId) {
                await t.rollback();
                return res.status(400).json({ message: 'WarehouseId wajib dipilih' });
            }

            const header = await Stock_In_Header.create({
                ...headerData,
                WarehouseId: headerWhId,
                date: headerData.date || new Date(),
                companyId: cid,
            }, { transaction: t });

            const movements = [];
            for (const item of items) {
                const { ProductId, quantity, note } = item;
                const WarehouseId = item.WarehouseId || headerWhId;
                if (!ProductId || !WarehouseId || !quantity || quantity <= 0) {
                    await t.rollback();
                    return res.status(400).json({ message: 'Setiap item harus memiliki ProductId dan quantity > 0' });
                }
                const [stock] = await Stock.findOrCreate({
                    where: { ProductId, WarehouseId },
                    defaults: { quantity: 0, companyId: cid },
                    transaction: t
                });
                await stock.increment('quantity', { by: quantity, transaction: t });
                movements.push(await Stock_Movement.create({
                    ProductId, WarehouseId, type: 'IN', quantity,
                    ReferenceId: header.id, note: note || null, companyId: cid
                }, { transaction: t }));
            }
            await t.commit();
            res.status(201).json({ ...header.toJSON(), movements });
        } catch (err) { await t.rollback(); next(err); }
    }

    static async update(req, res, next) {
        try {
            const header = await Stock_In_Header.findOne({ where: { id: req.params.id, ...companyFilter(req) } });
            if (!header) throw { name: 'NotFound', message: 'Stock in header not found' };
            await header.update(req.body);
            res.status(200).json(header);
        } catch (err) { next(err); }
    }

    static async delete(req, res, next) {
        try {
            const header = await Stock_In_Header.findOne({ where: { id: req.params.id, ...companyFilter(req) } });
            if (!header) throw { name: 'NotFound', message: 'Stock in header not found' };
            await header.destroy();
            res.status(200).json({ message: 'Stock in header deleted successfully' });
        } catch (err) { next(err); }
    }
}

module.exports = StockInHeaderController;
