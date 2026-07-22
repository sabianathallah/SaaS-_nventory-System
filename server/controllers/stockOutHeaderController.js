'use strict';
const { Op } = require('sequelize');
const { sequelize, Stock_Out_Header, Stock_Movement, Stock, SkuWarehouseStock, User, Product, ProductSKU, ProductVariantOption, Warehouse, Vendor, VendorDelivery } = require('../models');
const { companyFilter, companyId } = require('../helpers/tenancy');
const { upsertSkuWarehouseStock } = require('../helpers/skuStock');
const { paginate, buildFilter, paginatedResponse } = require('../helpers/queryHelper');

class StockOutHeaderController {
    static async getAll(req, res, next) {
        try {
            const { page, limit, offset } = paginate(req.query);
            const filter = buildFilter(req.query, {
                destination:  'like',
                WarehouseId:  'exact',
                dateFrom:     { field: 'date', type: 'gte' },
                dateTo:       { field: 'date', type: 'lte' },
            });
            // Search umum: tujuan/keperluan header + nama produk di dalam item.
            // Search catatan terpisah: catatan header + catatan per item.
            const extra = [];
            if (req.query.search) {
                const term = sequelize.escape(`%${req.query.search}%`);
                extra.push({
                    [Op.or]: [
                        { destination: { [Op.iLike]: `%${req.query.search}%` } },
                        { purpose:     { [Op.iLike]: `%${req.query.search}%` } },
                        sequelize.literal(`"Stock_Out_Header"."id" IN (SELECT sm."ReferenceId" FROM "Stock_Movements" sm JOIN "Products" p ON sm."ProductId" = p.id WHERE sm."type" = 'OUT' AND p."name" ILIKE ${term})`),
                    ],
                });
            }
            if (req.query.noteSearch) {
                const term = sequelize.escape(`%${req.query.noteSearch}%`);
                extra.push({
                    [Op.or]: [
                        { notes: { [Op.iLike]: `%${req.query.noteSearch}%` } },
                        sequelize.literal(`"Stock_Out_Header"."id" IN (SELECT "ReferenceId" FROM "Stock_Movements" WHERE "type" = 'OUT' AND "note" ILIKE ${term})`),
                    ],
                });
            }

            const { rows, count } = await Stock_Out_Header.findAndCountAll({
                where: { ...companyFilter(req), ...filter, ...(extra.length && { [Op.and]: extra }) },
                attributes: {
                    include: [
                        [
                            sequelize.literal(`(SELECT COUNT(*) FROM "Stock_Movements" WHERE "ReferenceId" = "Stock_Out_Header"."id" AND "type" = 'OUT')`),
                            'itemCount'
                        ],
                        [
                            sequelize.literal(`(SELECT COALESCE(SUM(quantity), 0) FROM "Stock_Movements" WHERE "ReferenceId" = "Stock_Out_Header"."id" AND "type" = 'OUT')`),
                            'totalQty'
                        ],
                        [
                            sequelize.literal(`(SELECT COALESCE(SUM(sm.quantity * COALESCE(ps.price, 0)), 0) FROM "Stock_Movements" sm LEFT JOIN "ProductSKUs" ps ON sm."ProductSKUId" = ps.id WHERE sm."ReferenceId" = "Stock_Out_Header"."id" AND sm."type" = 'OUT')`),
                            'grandTotal'
                        ],
                    ]
                },
                include: [
                    { model: User, foreignKey: 'createdBy', attributes: ['id', 'name'] },
                    { model: User, foreignKey: 'updatedBy', as: 'updater', attributes: ['id', 'name'] },
                    { model: Warehouse, attributes: ['id', 'name'] },
                ],
                order: [['date', 'DESC'], ['id', 'DESC']],
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
                    { model: User, foreignKey: 'updatedBy', as: 'updater', attributes: ['id', 'name'] },
                    { model: Warehouse, attributes: ['id', 'name'] },
                    { model: Vendor, attributes: ['id', 'name'] },
                    { model: VendorDelivery, as: 'sourceDelivery', attributes: ['id', 'date'] },
                ]
            });
            if (!header) throw { name: 'NotFound', message: 'Stock out header not found' };
            const movements = await Stock_Movement.findAll({
                where: { ReferenceId: header.id, type: 'OUT', ...companyFilter(req) },
                include: [
                    { model: Product,   attributes: ['id', 'name', 'sku', 'unit'] },
                    { model: Warehouse, attributes: ['id', 'name'] },
                    { model: ProductSKU, attributes: ['id', 'sku_code', 'price'], required: false,
                      include: [{ model: ProductVariantOption, attributes: ['id', 'value'], through: { attributes: [] } }] },
                ]
            });
            const grandTotal = movements.reduce((s, m) => s + Number(m.ProductSKU?.price ?? 0) * m.quantity, 0);
            res.status(200).json({ ...header.toJSON(), movements, grandTotal });
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
                await Stock.findOrCreate({
                    where: { ProductId, WarehouseId },
                    defaults: { quantity: 0, companyId: cid },
                    transaction: t,
                });
                resolvedItems.push({ ...item, ProductId, ProductSKUId: ProductSKUId || null, WarehouseId });
            }

            const header = await Stock_Out_Header.create(
                {
                    ...headerData,
                    WarehouseId: headerWhId,
                    date: headerData.date || new Date(),
                    VendorId: headerData.VendorId || null,
                    sourceDeliveryId: headerData.sourceDeliveryId || null,
                    createdBy: req.user.id,
                    companyId: cid,
                },
                { transaction: t }
            );
            // Validate and decrement stock atomically with row lock to prevent TOCTOU race
            const movements = [];
            for (const item of resolvedItems) {
                const { ProductId, ProductSKUId, quantity, note, WarehouseId } = item;

                if (ProductSKUId) {
                    // Per-SKU check against SkuWarehouseStocks (source of truth)
                    const skuStock = await SkuWarehouseStock.findOne({
                        where: { ProductSKUId, WarehouseId },
                        transaction: t, lock: t.LOCK.UPDATE,
                    });
                    const available = skuStock ? Number(skuStock.qty) : 0;
                    if (available < quantity) {
                        await t.rollback();
                        return res.status(400).json({ message: `Stok tidak cukup di gudang yang dipilih (tersedia: ${available}, dibutuhkan: ${quantity})` });
                    }
                    const sku = await ProductSKU.findByPk(ProductSKUId, { transaction: t });
                    if (sku) await sku.decrement('qty', { by: quantity, transaction: t });
                    await upsertSkuWarehouseStock(t, SkuWarehouseStock, { ProductSKUId, WarehouseId, delta: -quantity, companyId: cid });
                } else {
                    // Fallback: product-level check via Stocks (no SKU assigned)
                    const stock = await Stock.findOne({ where: { ProductId, WarehouseId }, transaction: t, lock: t.LOCK.UPDATE });
                    const available = stock ? Number(stock.quantity) : 0;
                    if (available < quantity) {
                        await t.rollback();
                        return res.status(400).json({ message: `Stok tidak cukup di gudang yang dipilih (tersedia: ${available}, dibutuhkan: ${quantity})` });
                    }
                    await stock.decrement('quantity', { by: quantity, transaction: t });
                }

                // Keep Stocks table in sync (secondary, non-blocking)
                const stock = await Stock.findOne({ where: { ProductId, WarehouseId }, transaction: t });
                if (stock && ProductSKUId) {
                    const newQty = Math.max(0, Number(stock.quantity) - quantity);
                    await stock.update({ quantity: newQty }, { transaction: t });
                }

                movements.push(await Stock_Movement.create({
                    ProductId, ProductSKUId, WarehouseId, type: 'OUT', quantity,
                    ReferenceId: header.id, source: 'STOCK_OUT', note: note || null,
                    date: header.date || new Date(),
                    companyId: cid
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
            if (header.status !== 'open') {
                return res.status(400).json({ message: 'Sesi masih terkunci. Buka sesi dulu untuk mengedit.' });
            }
            // WarehouseId changes are blocked — moving stock requires delete + recreate
            if (req.body.WarehouseId && Number(req.body.WarehouseId) !== header.WarehouseId) {
                return res.status(400).json({ message: 'Gudang tidak dapat diubah. Hapus dan buat ulang dokumen untuk mengganti gudang.' });
            }
            const { date, destination, notes } = req.body;
            await header.update({ date, destination, notes, updatedBy: req.user.id });
            res.status(200).json(header);
        } catch (err) { next(err); }
    }

    // PATCH /:id/status — buka/tutup sesi edit
    static async setStatus(req, res, next) {
        try {
            const header = await Stock_Out_Header.findOne({ where: { id: req.params.id, ...companyFilter(req) } });
            if (!header) throw { name: 'NotFound', message: 'Stock out header not found' };
            const { status } = req.body;
            if (!['open', 'closed'].includes(status)) {
                return res.status(400).json({ message: "status harus 'open' atau 'closed'" });
            }
            await header.update({ status, updatedBy: req.user.id });
            res.status(200).json(header);
        } catch (err) { next(err); }
    }

    // ── Item sub-routes (item = Stock_Movement type OUT) ─────────────────────────
    // Semua mutasi item mengoreksi stok dengan pola yang sama seperti create/delete.

    static async addItem(req, res, next) {
        const t = await sequelize.transaction();
        try {
            const header = await Stock_Out_Header.findOne({ where: { id: req.params.id, ...companyFilter(req) }, transaction: t });
            if (!header) { await t.rollback(); throw { name: 'NotFound', message: 'Stock out header not found' }; }
            if (header.status !== 'open') {
                await t.rollback();
                return res.status(400).json({ message: 'Sesi masih terkunci. Buka sesi dulu untuk menambah item.' });
            }

            const cid = companyId(req);
            let { ProductId, ProductSKUId, quantity, note } = req.body;
            const WarehouseId = header.WarehouseId;
            quantity = Number(quantity);
            if (!quantity || quantity <= 0) { await t.rollback(); return res.status(400).json({ message: 'Quantity harus > 0' }); }
            if (!ProductId && ProductSKUId) {
                const sku = await ProductSKU.findByPk(ProductSKUId, { transaction: t });
                if (!sku) { await t.rollback(); return res.status(400).json({ message: `ProductSKU id=${ProductSKUId} tidak ditemukan` }); }
                ProductId = sku.ProductId;
            }
            if (!ProductId) { await t.rollback(); return res.status(400).json({ message: 'ProductId atau ProductSKUId wajib diisi' }); }

            if (ProductSKUId) {
                const skuStock = await SkuWarehouseStock.findOne({ where: { ProductSKUId, WarehouseId }, transaction: t, lock: t.LOCK.UPDATE });
                const available = skuStock ? Number(skuStock.qty) : 0;
                if (available < quantity) {
                    await t.rollback();
                    return res.status(400).json({ message: `Stok tidak cukup di gudang (tersedia: ${available}, dibutuhkan: ${quantity})` });
                }
                const sku = await ProductSKU.findByPk(ProductSKUId, { transaction: t });
                if (sku) await sku.decrement('qty', { by: quantity, transaction: t });
                await upsertSkuWarehouseStock(t, SkuWarehouseStock, { ProductSKUId, WarehouseId, delta: -quantity, companyId: cid });
                const stock = await Stock.findOne({ where: { ProductId, WarehouseId }, transaction: t });
                if (stock) await stock.update({ quantity: Math.max(0, Number(stock.quantity) - quantity) }, { transaction: t });
            } else {
                const stock = await Stock.findOne({ where: { ProductId, WarehouseId }, transaction: t, lock: t.LOCK.UPDATE });
                const available = stock ? Number(stock.quantity) : 0;
                if (available < quantity) {
                    await t.rollback();
                    return res.status(400).json({ message: `Stok tidak cukup di gudang (tersedia: ${available}, dibutuhkan: ${quantity})` });
                }
                await stock.decrement('quantity', { by: quantity, transaction: t });
            }

            const movement = await Stock_Movement.create({
                ProductId, ProductSKUId: ProductSKUId || null, WarehouseId, type: 'OUT', quantity,
                ReferenceId: header.id, source: 'STOCK_OUT', note: note || null,
                date: header.date || new Date(),
                companyId: cid,
            }, { transaction: t });

            await header.update({ updatedBy: req.user.id }, { transaction: t });
            await t.commit();
            res.status(201).json(movement);
        } catch (err) { await t.rollback(); next(err); }
    }

    static async updateItem(req, res, next) {
        const t = await sequelize.transaction();
        try {
            const header = await Stock_Out_Header.findOne({ where: { id: req.params.id, ...companyFilter(req) }, transaction: t });
            if (!header) { await t.rollback(); throw { name: 'NotFound', message: 'Stock out header not found' }; }
            if (header.status !== 'open') {
                await t.rollback();
                return res.status(400).json({ message: 'Sesi masih terkunci. Buka sesi dulu untuk mengedit item.' });
            }

            const mv = await Stock_Movement.findOne({
                where: { id: req.params.itemId, ReferenceId: header.id, type: 'OUT' },
                transaction: t, lock: t.LOCK.UPDATE,
            });
            if (!mv) { await t.rollback(); throw { name: 'NotFound', message: 'Item not found' }; }

            const newQty = Number(req.body.quantity);
            if (!newQty || newQty <= 0) { await t.rollback(); return res.status(400).json({ message: 'Quantity harus > 0' }); }
            const delta = newQty - mv.quantity; // >0 = keluar lebih banyak (butuh stok), <0 = stok balik

            if (delta !== 0) {
                if (mv.ProductSKUId) {
                    if (delta > 0) {
                        const skuStock = await SkuWarehouseStock.findOne({ where: { ProductSKUId: mv.ProductSKUId, WarehouseId: mv.WarehouseId }, transaction: t, lock: t.LOCK.UPDATE });
                        const available = skuStock ? Number(skuStock.qty) : 0;
                        if (available < delta) {
                            await t.rollback();
                            return res.status(400).json({ message: `Stok tidak cukup untuk menambah qty (tersedia: ${available}, dibutuhkan: ${delta})` });
                        }
                    }
                    const sku = await ProductSKU.findByPk(mv.ProductSKUId, { transaction: t });
                    if (sku) await sku.increment('qty', { by: -delta, transaction: t });
                    await upsertSkuWarehouseStock(t, SkuWarehouseStock, { ProductSKUId: mv.ProductSKUId, WarehouseId: mv.WarehouseId, delta: -delta, companyId: mv.companyId });
                    const stock = await Stock.findOne({ where: { ProductId: mv.ProductId, WarehouseId: mv.WarehouseId }, transaction: t });
                    if (stock) await stock.update({ quantity: Math.max(0, Number(stock.quantity) - delta) }, { transaction: t });
                } else {
                    const stock = await Stock.findOne({ where: { ProductId: mv.ProductId, WarehouseId: mv.WarehouseId }, transaction: t, lock: t.LOCK.UPDATE });
                    const available = stock ? Number(stock.quantity) : 0;
                    if (delta > 0 && available < delta) {
                        await t.rollback();
                        return res.status(400).json({ message: `Stok tidak cukup untuk menambah qty (tersedia: ${available}, dibutuhkan: ${delta})` });
                    }
                    if (stock) await stock.increment('quantity', { by: -delta, transaction: t });
                }
            }

            await mv.update({ quantity: newQty }, { transaction: t });
            await header.update({ updatedBy: req.user.id }, { transaction: t });
            await t.commit();
            res.status(200).json(mv);
        } catch (err) { await t.rollback(); next(err); }
    }

    static async removeItem(req, res, next) {
        const t = await sequelize.transaction();
        try {
            const header = await Stock_Out_Header.findOne({ where: { id: req.params.id, ...companyFilter(req) }, transaction: t });
            if (!header) { await t.rollback(); throw { name: 'NotFound', message: 'Stock out header not found' }; }
            if (header.status !== 'open') {
                await t.rollback();
                return res.status(400).json({ message: 'Sesi masih terkunci. Buka sesi dulu untuk menghapus item.' });
            }

            const mv = await Stock_Movement.findOne({
                where: { id: req.params.itemId, ReferenceId: header.id, type: 'OUT' },
                transaction: t, lock: t.LOCK.UPDATE,
            });
            if (!mv) { await t.rollback(); throw { name: 'NotFound', message: 'Item not found' }; }

            // Kembalikan stok lalu hapus movement (kebalikan dari addItem)
            const stock = await Stock.findOne({ where: { ProductId: mv.ProductId, WarehouseId: mv.WarehouseId }, transaction: t });
            if (stock) await stock.increment('quantity', { by: mv.quantity, transaction: t });
            if (mv.ProductSKUId) {
                const sku = await ProductSKU.findByPk(mv.ProductSKUId, { transaction: t });
                if (sku) await sku.increment('qty', { by: mv.quantity, transaction: t });
                await upsertSkuWarehouseStock(t, SkuWarehouseStock, { ProductSKUId: mv.ProductSKUId, WarehouseId: mv.WarehouseId, delta: mv.quantity, companyId: mv.companyId });
            }
            await mv.destroy({ transaction: t });

            await header.update({ updatedBy: req.user.id }, { transaction: t });
            await t.commit();
            res.status(200).json({ message: 'Item dihapus, stok dikembalikan' });
        } catch (err) { await t.rollback(); next(err); }
    }

    static async delete(req, res, next) {
        const t = await sequelize.transaction();
        try {
            const header = await Stock_Out_Header.findOne({
                where: { id: req.params.id, ...companyFilter(req) },
                transaction: t,
            });
            if (!header) { await t.rollback(); throw { name: 'NotFound', message: 'Stock out header not found' }; }

            const movements = await Stock_Movement.findAll({
                where: { ReferenceId: header.id, type: 'OUT' },
                transaction: t,
            });
            for (const mv of movements) {
                const stock = await Stock.findOne({
                    where: { ProductId: mv.ProductId, WarehouseId: mv.WarehouseId },
                    transaction: t,
                });
                if (stock) await stock.increment('quantity', { by: mv.quantity, transaction: t });
                if (mv.ProductSKUId) {
                    const sku = await ProductSKU.findByPk(mv.ProductSKUId, { transaction: t });
                    if (sku) await sku.increment('qty', { by: mv.quantity, transaction: t });
                    await upsertSkuWarehouseStock(t, SkuWarehouseStock, { ProductSKUId: mv.ProductSKUId, WarehouseId: mv.WarehouseId, delta: mv.quantity, companyId: mv.companyId });
                }
            }
            await Stock_Movement.destroy({ where: { ReferenceId: header.id }, transaction: t });
            await header.destroy({ transaction: t });
            await t.commit();
            res.status(200).json({ message: 'Stock out header deleted successfully' });
        } catch (err) { await t.rollback(); next(err); }
    }
}

module.exports = StockOutHeaderController;
