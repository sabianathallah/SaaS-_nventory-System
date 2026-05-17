'use strict';
const { sequelize, Stock_Out_Header, Stock_Movement, Stock, User, Product, ProductSKU, ProductVariantOption, Warehouse } = require('../models');
const { companyFilter, companyId } = require('../helpers/tenancy');
const { paginate, buildFilter, paginatedResponse } = require('../helpers/queryHelper');

class StockOutHeaderController {
    static async getAll(req, res, next) {
        try {
            const { page, limit, offset } = paginate(req.query);
            const filter = buildFilter(req.query, {
                destination: 'like',
                dateFrom:    { field: 'date', type: 'gte' },
                dateTo:      { field: 'date', type: 'lte' },
            });
            const { rows, count } = await Stock_Out_Header.findAndCountAll({
                where: { ...companyFilter(req), ...filter },
                include: [
                    { model: User, foreignKey: 'createdBy', attributes: ['id', 'name'] },
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
            const header = await Stock_Out_Header.findOne({
                where: { id: req.params.id, ...companyFilter(req) },
                include: [
                    { model: User, foreignKey: 'createdBy', attributes: ['id', 'name'] },
                    { model: Warehouse, attributes: ['id', 'name'] },
                ]
            });
            if (!header) throw { name: 'NotFound', message: 'Stock out header not found' };
            const movements = await Stock_Movement.findAll({
                where: { ReferenceId: header.id, type: 'OUT', ...companyFilter(req) },
                include: [
                    { model: Product,   attributes: ['id', 'name', 'sku', 'unit'] },
                    { model: Warehouse, attributes: ['id', 'name'] },
                    { model: ProductSKU, attributes: ['id', 'sku_code'], required: false,
                      include: [{ model: ProductVariantOption, attributes: ['id', 'value'], through: { attributes: [] } }] },
                ]
            });
            res.status(200).json({ ...header.toJSON(), movements });
        } catch (err) { next(err); }
    }

    static async create(req, res, next) {
        console.log('[StockOut] raw body:', JSON.stringify(req.body));
        const t = await sequelize.transaction();
        try {
            const { items = [], ...headerData } = req.body;
            const cid = companyId(req);
            console.log('[StockOut] items:', JSON.stringify(items));
            if (!items.length) { await t.rollback(); return res.status(400).json({ message: 'Items tidak boleh kosong' }); }

            // FE uses "note" singular at header; model column is "notes" plural.
            if (headerData.note && !headerData.notes) headerData.notes = headerData.note;
            delete headerData.note;

            const headerWhId = headerData.WarehouseId || items.find(i => i.WarehouseId)?.WarehouseId || null;
            if (!headerWhId) {
                await t.rollback();
                return res.status(400).json({ message: 'WarehouseId wajib dipilih' });
            }
            if (!headerData.purpose) {
                await t.rollback();
                return res.status(400).json({ message: 'Tujuan stock out wajib dipilih' });
            }

            // Resolve ProductId from ProductSKUId when not provided directly
            const resolvedItems = [];
            for (const item of items) {
                let { ProductId, ProductSKUId, quantity } = item;
                const WarehouseId = item.WarehouseId || headerWhId;
                if (!ProductId && ProductSKUId) {
                    const sku = await ProductSKU.findByPk(ProductSKUId, { transaction: t });
                    if (!sku) { await t.rollback(); return res.status(400).json({ message: `ProductSKU id=${ProductSKUId} tidak ditemukan` }); }
                    ProductId = sku.ProductId;
                }
                if (!ProductId || !WarehouseId || !quantity || quantity <= 0) {
                    await t.rollback();
                    return res.status(400).json({ message: `DEBUG: ProductId=${ProductId} WarehouseId=${WarehouseId} quantity=${quantity} skuId=${ProductSKUId}` });
                }
                const stock = await Stock.findOne({ where: { ProductId, WarehouseId }, transaction: t });
                if (!stock) { await t.rollback(); return res.status(400).json({ message: `Stok tidak ditemukan untuk ProductId=${ProductId} di WarehouseId=${WarehouseId}` }); }
                if (stock.quantity < quantity) { await t.rollback(); return res.status(400).json({ message: `Stok tidak cukup untuk ProductId=${ProductId}. Tersedia: ${stock.quantity}, diminta: ${quantity}` }); }
                resolvedItems.push({ ...item, ProductId, ProductSKUId: ProductSKUId || null, WarehouseId });
            }

            const header = await Stock_Out_Header.create(
                {
                    ...headerData,
                    WarehouseId: headerWhId,
                    date: headerData.date || new Date(),
                    createdBy: req.user.id,
                    companyId: cid,
                },
                { transaction: t }
            );
            const movements = [];
            for (const item of resolvedItems) {
                const { ProductId, ProductSKUId, quantity, note, WarehouseId } = item;
                const stock = await Stock.findOne({ where: { ProductId, WarehouseId }, transaction: t });
                await stock.decrement('quantity', { by: quantity, transaction: t });

                movements.push(await Stock_Movement.create({
                    ProductId, ProductSKUId, WarehouseId, type: 'OUT', quantity,
                    ReferenceId: header.id, note: note || null, companyId: cid
                }, { transaction: t }));
            }
            await t.commit();
            res.status(201).json({ ...header.toJSON(), movements });
        } catch (err) { await t.rollback(); next(err); }
    }

    static async update(req, res, next) {
        try {
            const header = await Stock_Out_Header.findOne({ where: { id: req.params.id, ...companyFilter(req) } });
            if (!header) throw { name: 'NotFound', message: 'Stock out header not found' };
            const { date, WarehouseId, destination, notes } = req.body;
            await header.update({ date, WarehouseId, destination, notes });
            res.status(200).json(header);
        } catch (err) { next(err); }
    }

    static async delete(req, res, next) {
        try {
            const header = await Stock_Out_Header.findOne({ where: { id: req.params.id, ...companyFilter(req) } });
            if (!header) throw { name: 'NotFound', message: 'Stock out header not found' };
            await header.destroy();
            res.status(200).json({ message: 'Stock out header deleted successfully' });
        } catch (err) { next(err); }
    }
}

module.exports = StockOutHeaderController;
