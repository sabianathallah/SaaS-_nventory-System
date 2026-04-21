'use strict';
const { sequelize, Stock_Opname_Session, Stock_Opname_Item, Stock, Stock_Movement, Warehouse, User, Product } = require('../models');
const { companyFilter, companyId } = require('../helpers/tenancy');
const { paginate, buildFilter, paginatedResponse } = require('../helpers/queryHelper');

class StockOpnameSessionController {
    static async getAll(req, res, next) {
        try {
            const { page, limit, offset } = paginate(req.query);
            const filter = buildFilter(req.query, {
                status:      'exact',
                warehouseId: 'exact',
                dateFrom:    { field: 'started_at', type: 'gte' },
                dateTo:      { field: 'started_at', type: 'lte' },
            });
            const { rows, count } = await Stock_Opname_Session.findAndCountAll({
                where: { ...companyFilter(req), ...filter },
                include: [
                    { model: Warehouse, attributes: ['id', 'name'] },
                    { model: User, foreignKey: 'createdBy', attributes: ['id', 'name'] }
                ],
                order: [['started_at', 'DESC']],
                limit, offset,
                distinct: true
            });
            res.status(200).json(paginatedResponse(rows, count, page, limit));
        } catch (err) { next(err); }
    }

    static async getById(req, res, next) {
        try {
            const session = await Stock_Opname_Session.findOne({
                where: { id: req.params.id, ...companyFilter(req) },
                include: [
                    { model: Warehouse, attributes: ['id', 'name'] },
                    { model: User, foreignKey: 'createdBy', attributes: ['id', 'name'] },
                    { model: Stock_Opname_Item, include: [{ model: Product, attributes: ['id', 'name', 'sku', 'unit'] }] }
                ]
            });
            if (!session) throw { name: 'NotFound', message: 'Stock opname session not found' };
            res.status(200).json(session);
        } catch (err) { next(err); }
    }

    static async create(req, res, next) {
        try {
            const session = await Stock_Opname_Session.create({
                ...req.body, createdBy: req.user.id, companyId: companyId(req)
            });
            res.status(201).json(session);
        } catch (err) { next(err); }
    }

    static async update(req, res, next) {
        const t = await sequelize.transaction();
        try {
            const session = await Stock_Opname_Session.findOne({
                where: { id: req.params.id, ...companyFilter(req) }, transaction: t
            });
            if (!session) { await t.rollback(); throw { name: 'NotFound', message: 'Stock opname session not found' }; }

            const isClosing = req.body.status === 'closed' && session.status !== 'closed';
            await session.update({
                ...req.body,
                ...(isClosing && !req.body.finished_at ? { finished_at: new Date() } : {})
            }, { transaction: t });

            if (isClosing) {
                const items = await Stock_Opname_Item.findAll({ where: { SessionId: session.id }, transaction: t });
                for (const item of items) {
                    const diff = item.difference ?? (item.scanned_qty - item.system_qty);
                    if (diff === 0) continue;
                    const stock = await Stock.findOne({ where: { ProductId: item.ProductId, WarehouseId: session.warehouseId }, transaction: t });
                    if (stock) await stock.update({ quantity: Math.max(0, stock.quantity + diff) }, { transaction: t });
                    await Stock_Movement.create({
                        ProductId: item.ProductId, WarehouseId: session.warehouseId,
                        type: 'ADJUSTMENT', quantity: Math.abs(diff),
                        ReferenceId: session.id,
                        note: `Opname koreksi: ${diff > 0 ? '+' : ''}${diff}`,
                        companyId: session.companyId
                    }, { transaction: t });
                }
            }
            await t.commit();
            res.status(200).json(session);
        } catch (err) { await t.rollback(); next(err); }
    }

    static async delete(req, res, next) {
        try {
            const session = await Stock_Opname_Session.findOne({ where: { id: req.params.id, ...companyFilter(req) } });
            if (!session) throw { name: 'NotFound', message: 'Stock opname session not found' };
            await session.destroy();
            res.status(200).json({ message: 'Stock opname session deleted successfully' });
        } catch (err) { next(err); }
    }
}

module.exports = StockOpnameSessionController;
