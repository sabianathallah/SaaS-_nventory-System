'use strict';
const { sequelize, Stock_Opname_Session, Stock_Opname_Item, Stock, Stock_Movement, Warehouse, User, Product, ProductSKU, ProductVariantOption } = require('../models');
const { companyFilter, companyId } = require('../helpers/tenancy');
const { paginate, buildFilter, paginatedResponse } = require('../helpers/queryHelper');

class StockOpnameSessionController {
    static async getAll(req, res, next) {
        try {
            const { page, limit, offset } = paginate(req.query);
            const filter = buildFilter(req.query, {
                status:      'in',   // supports comma-separated e.g. status=open,closed
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
                    {
                        model: Stock_Opname_Item,
                        include: [
                            { model: Product, attributes: ['id', 'name', 'sku', 'unit'] },
                            {
                                model: ProductSKU, attributes: ['id', 'sku_code'], required: false,
                                include: [{ model: ProductVariantOption, attributes: ['id', 'value'], through: { attributes: [] } }],
                            },
                        ],
                    }
                ]
            });
            if (!session) throw { name: 'NotFound', message: 'Stock opname session not found' };
            res.status(200).json(session);
        } catch (err) { next(err); }
    }

    static async create(req, res, next) {
        try {
            // FE uses capitalized WarehouseId to stay consistent with other forms,
            // but the column on the session table is `warehouseId` (lowercase).
            const body = { ...req.body };
            if (body.WarehouseId && !body.warehouseId) body.warehouseId = body.WarehouseId;
            delete body.WarehouseId;

            const session = await Stock_Opname_Session.create({
                ...body,
                started_at: body.started_at || new Date(),
                status:     body.status     || 'open',
                createdBy:  req.user.id,
                companyId:  companyId(req),
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

            if (session.status === 'closed' && req.body.status === 'open') {
                await t.rollback();
                return res.status(400).json({ message: 'Sesi opname yang sudah ditutup tidak dapat dibuka kembali' });
            }
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
                    // Apply diff as a delta so multiple SKUs of the same product
                    // accumulate correctly (absolute override would overwrite siblings).
                    const stock = await Stock.findOne({ where: { ProductId: item.ProductId, WarehouseId: session.warehouseId }, transaction: t });
                    if (stock) await stock.increment('quantity', { by: diff, transaction: t });

                    if (item.ProductSKUId) {
                        const sku = await ProductSKU.findByPk(item.ProductSKUId, { transaction: t });
                        if (sku) await sku.increment('qty', { by: diff, transaction: t });
                    }
                    await Stock_Movement.create({
                        ProductId:    item.ProductId,
                        WarehouseId:  session.warehouseId,
                        ProductSKUId: item.ProductSKUId ?? null,
                        type:         'ADJUSTMENT',
                        quantity:     diff,
                        ReferenceId:  session.id,
                        note:         `Opname koreksi: ${diff > 0 ? '+' : ''}${diff}`,
                        date:         session.finished_at || new Date(),
                        companyId:    session.companyId
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
