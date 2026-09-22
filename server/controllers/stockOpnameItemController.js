'use strict';
const { Stock_Opname_Item, Stock_Opname_Session, Product, ProductSKU, ProductVariantOption, ProductVariantType, Stock, SkuWarehouseStock } = require('../models');
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
                    { model: Product, attributes: ['id', 'name', 'sku'] },
                    { model: ProductSKU, attributes: ['id', 'sku_code'], required: false,
                      include: [{ model: ProductVariantOption, attributes: ['id', 'value'], through: { attributes: [] },
                        include: [{ model: ProductVariantType, attributes: ['id', 'name'] }] }] },
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
                    { model: Product, attributes: ['id', 'name', 'sku'] },
                    { model: ProductSKU, attributes: ['id', 'sku_code'], required: false,
                      include: [{ model: ProductVariantOption, attributes: ['id', 'value'], through: { attributes: [] },
                        include: [{ model: ProductVariantType, attributes: ['id', 'name'] }] }] },
                ]
            });
            if (!item) throw { name: 'NotFound', message: 'Stock opname item not found' };
            res.status(200).json(item);
        } catch (err) { next(err); }
    }

    static async create(req, res, next) {
        try {
            // Normalize FE payload → model columns.
            // FE sends { StockOpnameSessionId, ProductId, actualQty }; the model
            // uses SessionId + scanned_qty, and system_qty/difference are derived
            // from the current Stock snapshot.
            const body = { ...req.body };
            const SessionId = body.SessionId || body.StockOpnameSessionId;
            const scanned_qty = body.scanned_qty ?? body.actualQty;
            const { ProductId, ProductSKUId } = body;

            if (!SessionId || !ProductId || scanned_qty == null) {
                return res.status(400).json({ message: 'SessionId, ProductId, dan actualQty wajib diisi' });
            }

            const session = await Stock_Opname_Session.findOne({ where: { id: SessionId, ...companyFilter(req) } });
            if (!session) return res.status(404).json({ message: 'Opname session tidak ditemukan' });
            if (session.status !== 'open') return res.status(400).json({ message: 'Tidak bisa menambah item ke sesi yang sudah ditutup atau dibatalkan' });

            let system_qty = body.system_qty;
            if (system_qty == null) {
                if (ProductSKUId) {
                    // Per-SKU, per-warehouse qty from SkuWarehouseStocks — the live ledger.
                    // ProductSKU.qty is a legacy cross-warehouse total and would be wrong
                    // for any company with more than one warehouse.
                    const skuStock = await SkuWarehouseStock.findOne({
                        where: { ProductSKUId, WarehouseId: session.warehouseId },
                    });
                    system_qty = skuStock?.qty ?? 0;
                } else {
                    const stock = await Stock.findOne({
                        where: { ProductId, WarehouseId: session.warehouseId },
                    });
                    system_qty = stock?.quantity ?? 0;
                }
            }
            const scanned = Number(scanned_qty);
            const difference = scanned - Number(system_qty);

            const item = await Stock_Opname_Item.create({
                SessionId,
                ProductId,
                ProductSKUId: ProductSKUId || null,
                scanned_qty: scanned,
                system_qty,
                difference,
            });
            res.status(201).json(item);
        } catch (err) { next(err); }
    }

    static async update(req, res, next) {
        try {
            const item = await Stock_Opname_Item.findByPk(req.params.id, {
                include: [{ model: Stock_Opname_Session, where: companyFilter(req), required: true }]
            });
            if (!item) throw { name: 'NotFound', message: 'Stock opname item not found' };
            const { scanned_qty, difference } = req.body;
            const updates = {};
            if (scanned_qty != null) {
                updates.scanned_qty = Number(scanned_qty);
                // Recalculate difference when scanned_qty changes (unless client sends explicit override)
                if (difference == null) updates.difference = Number(scanned_qty) - Number(item.system_qty);
            }
            if (difference != null) updates.difference = Number(difference);
            await item.update(updates);
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
