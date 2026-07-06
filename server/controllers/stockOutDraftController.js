'use strict';
const {
    sequelize, Stock_Out_Draft, Stock_Out_Draft_Item,
    Stock_Out_Header, Stock_Movement, Stock, SkuWarehouseStock,
    ProductSKU, Product, ProductVariantOption, Warehouse, User,
    Request, RequestItem, RequestType, ManualShipment, ManualShipmentItem,
} = require('../models');
const { upsertSkuWarehouseStock } = require('../helpers/skuStock');
const { companyFilter, companyId } = require('../helpers/tenancy');
const manualShipmentCtrl = require('./manualShipmentController');

// If this draft was auto-staged from an approved Sales/Non-Sales pengajuan,
// finishing the Stock Out is the trigger to create the Shipping Manual draft —
// mirrors the item-snapshot logic that used to live in requestController.approve().
async function createShipmentFromRequest(request, cid, userId, t) {
    const shipmentType = request.requestType?.shipmentType === 'sales' ? 'sales' : 'non_sales';
    const invoiceNumber = await manualShipmentCtrl.generateInvoiceNumber(cid, t);

    let subtotal = 0;
    const itemsPayload = [];
    for (const item of request.items) {
        const skuPrice  = shipmentType === 'sales' ? Number(item.sku?.price ?? 0) : 0;
        const lineTotal = skuPrice * item.qty;
        subtotal += lineTotal;
        itemsPayload.push({
            productId:       item.sku?.ProductId ?? null,
            productSkuId:    item.ProductSKUId   ?? null,
            productName:     item.sku?.Product?.name ?? item.productName,
            variantName:     item.variantLabel    ?? null,
            sku:             item.sku?.sku_code   ?? null,
            productImageUrl: item.sku?.Product?.imageUrl ?? null,
            quantity:        item.qty,
            unitPrice:       skuPrice,
            subtotal:        lineTotal,
        });
    }

    const shipment = await ManualShipment.create({
        companyId:       cid,
        invoiceNumber,
        type:            shipmentType,
        status:          'draft',
        recipientName:    request.recipientName    || null,
        recipientPhone:   request.recipientPhone   || null,
        recipientAddress: request.recipientAddress || null,
        shippingCost:    0,
        subtotal,
        total:           subtotal,
        notes:           request.note || null,
        sourceRequestId: request.id,
        createdBy:       userId,
    }, { transaction: t });

    for (const item of itemsPayload) {
        await ManualShipmentItem.create({ shipmentId: shipment.id, ...item }, { transaction: t });
    }

    return shipment;
}

const DRAFT_ITEM_INCLUDE = [
    {
        model: Stock_Out_Draft_Item,
        include: [
            {
                model: ProductSKU,
                attributes: ['id', 'sku_code', 'price', 'qty'],
                include: [
                    { model: Product, attributes: ['id', 'name', 'imageUrl', 'unit'] },
                    { model: ProductVariantOption, attributes: ['id', 'value'], through: { attributes: [] } },
                ],
            },
            { model: Product, attributes: ['id', 'name', 'imageUrl', 'unit'] },
        ],
    },
    { model: Warehouse, attributes: ['id', 'name'] },
];

async function findDraft(id, req) {
    const draft = await Stock_Out_Draft.findOne({
        where: { id, ...companyFilter(req) },
        include: DRAFT_ITEM_INCLUDE,
    });
    if (!draft) throw { name: 'NotFound', message: 'Draft tidak ditemukan' };
    return draft;
}

class StockOutDraftController {
    static async current(req, res, next) {
        try {
            const drafts = await Stock_Out_Draft.findAll({
                where: { status: 'draft', ...companyFilter(req) },
                include: [
                    ...DRAFT_ITEM_INCLUDE,
                    { model: User, attributes: ['id', 'name', 'avatar'], foreignKey: 'createdBy' },
                ],
                order: [['createdAt', 'DESC']],
            });
            res.status(200).json(drafts);
        } catch (err) { next(err); }
    }

    static async get(req, res, next) {
        try {
            const draft = await Stock_Out_Draft.findOne({
                where: { id: req.params.id, ...companyFilter(req) },
                include: DRAFT_ITEM_INCLUDE,
            });
            if (!draft) return res.status(404).json({ message: 'Draft tidak ditemukan' });
            res.status(200).json(draft);
        } catch (err) { next(err); }
    }

    static async create(req, res, next) {
        try {
            const cid = companyId(req);
            let draft = await Stock_Out_Draft.create({
                createdBy: req.user.id,
                companyId: cid,
                status: 'draft',
            });
            draft = await Stock_Out_Draft.findOne({
                where: { id: draft.id },
                include: DRAFT_ITEM_INCLUDE,
            });
            res.status(201).json(draft);
        } catch (err) { next(err); }
    }

    static async ensure(req, res, next) {
        try {
            const cid = companyId(req);
            let draft = await Stock_Out_Draft.findOne({
                where: { status: 'draft', createdBy: req.user.id, ...companyFilter(req) },
                include: DRAFT_ITEM_INCLUDE,
            });
            if (!draft) {
                draft = await Stock_Out_Draft.create({
                    createdBy: req.user.id,
                    companyId: cid,
                    status: 'draft',
                });
                draft = await Stock_Out_Draft.findOne({
                    where: { id: draft.id },
                    include: DRAFT_ITEM_INCLUDE,
                });
            }
            res.status(200).json(draft);
        } catch (err) { next(err); }
    }

    static async update(req, res, next) {
        try {
            const draft = await Stock_Out_Draft.findOne({
                where: { id: req.params.id, ...companyFilter(req) },
            });
            if (!draft) throw { name: 'NotFound', message: 'Draft tidak ditemukan' };

            const updates = {};
            if (req.body.WarehouseId !== undefined) updates.WarehouseId = req.body.WarehouseId;
            if (req.body.date        !== undefined) updates.date        = req.body.date;
            if (req.body.purpose     !== undefined) updates.purpose     = req.body.purpose;
            if (req.body.note        !== undefined) updates.note        = req.body.note;
            await draft.update(updates);

            const result = await Stock_Out_Draft.findOne({
                where: { id: draft.id },
                include: DRAFT_ITEM_INCLUDE,
            });
            res.status(200).json(result);
        } catch (err) { next(err); }
    }

    static async addItem(req, res, next) {
        try {
            const draft = await Stock_Out_Draft.findOne({
                where: { id: req.params.id, status: 'draft', ...companyFilter(req) },
            });
            if (!draft) throw { name: 'NotFound', message: 'Draft tidak ditemukan atau sudah disubmit' };

            let { ProductSKUId, ProductId, quantity = 1 } = req.body;
            const cid = companyId(req);

            // Resolve ProductId from SKU if not provided
            if (ProductSKUId && !ProductId) {
                const sku = await ProductSKU.findByPk(ProductSKUId);
                if (sku) ProductId = sku.ProductId;
            }

            // Dedup: match by ProductSKUId if given, otherwise by ProductId
            let existing = null;
            if (ProductSKUId) {
                existing = await Stock_Out_Draft_Item.findOne({
                    where: { DraftId: draft.id, ProductSKUId },
                });
            } else if (ProductId) {
                existing = await Stock_Out_Draft_Item.findOne({
                    where: { DraftId: draft.id, ProductId, ProductSKUId: null },
                });
            }

            if (existing) {
                await existing.increment('quantity', { by: Number(quantity) });
                await existing.reload(); // flush increment ke in-memory instance
            } else {
                await Stock_Out_Draft_Item.create({
                    DraftId: draft.id,
                    ProductSKUId: ProductSKUId || null,
                    ProductId: ProductId || null,
                    quantity: Number(quantity),
                    companyId: cid,
                });
            }

            const result = await Stock_Out_Draft.findOne({
                where: { id: draft.id },
                include: DRAFT_ITEM_INCLUDE,
            });
            res.status(200).json(result);
        } catch (err) { next(err); }
    }

    static async updateItem(req, res, next) {
        try {
            const draft = await Stock_Out_Draft.findOne({ where: { id: req.params.id, ...companyFilter(req) } });
            if (!draft) throw { name: 'NotFound', message: 'Draft tidak ditemukan' };
            const item = await Stock_Out_Draft_Item.findOne({
                where: { id: req.params.itemId, DraftId: req.params.id },
            });
            if (!item) throw { name: 'NotFound', message: 'Item tidak ditemukan' };

            const updates = {};
            if (req.body.quantity !== undefined) updates.quantity = Number(req.body.quantity);
            await item.update(updates);
            res.status(200).json(item);
        } catch (err) { next(err); }
    }

    static async removeItem(req, res, next) {
        try {
            const draft = await Stock_Out_Draft.findOne({ where: { id: req.params.id, ...companyFilter(req) } });
            if (!draft) throw { name: 'NotFound', message: 'Draft tidak ditemukan' };
            const item = await Stock_Out_Draft_Item.findOne({
                where: { id: req.params.itemId, DraftId: req.params.id },
            });
            if (!item) throw { name: 'NotFound', message: 'Item tidak ditemukan' };
            await item.destroy();
            res.status(200).json({ message: 'Item removed' });
        } catch (err) { next(err); }
    }

    static async submit(req, res, next) {
        const t = await sequelize.transaction();
        try {
            const draft = await Stock_Out_Draft.findOne({
                where: { id: req.params.id, ...companyFilter(req) },
                include: DRAFT_ITEM_INCLUDE,
                transaction: t,
            });
            if (!draft) { await t.rollback(); throw { name: 'NotFound', message: 'Draft tidak ditemukan' }; }

            const WarehouseId = req.body.WarehouseId || draft.WarehouseId;
            const date        = req.body.date        || draft.date;
            const purpose     = req.body.purpose     || draft.purpose;
            const note        = req.body.note        !== undefined ? req.body.note : draft.note;

            if (!WarehouseId) {
                await t.rollback();
                return res.status(400).json({ message: 'WarehouseId wajib dipilih' });
            }
            if (!purpose) {
                await t.rollback();
                return res.status(400).json({ message: 'Tujuan stock out wajib dipilih' });
            }

            const items = draft.Stock_Out_Draft_Items || [];
            if (!items.length) {
                await t.rollback();
                return res.status(400).json({ message: 'Draft tidak memiliki item' });
            }

            const cid = companyId(req);

            const header = await Stock_Out_Header.create({
                WarehouseId,
                date: date || new Date(),
                purpose,
                notes: note || null,
                createdBy: req.user.id,
                companyId: cid,
            }, { transaction: t });

            // Resolve ProductIds then lock + check + decrement atomically to prevent TOCTOU race
            const resolvedItems = [];
            for (const item of items) {
                let { ProductSKUId, ProductId, quantity } = item;
                if (!ProductId && ProductSKUId) {
                    const sku = await ProductSKU.findByPk(ProductSKUId, { transaction: t });
                    if (sku) ProductId = sku.ProductId;
                }
                if (!ProductId) continue;
                resolvedItems.push({ ...item.toJSON(), ProductId });
            }

            const movements = [];
            for (const item of resolvedItems) {
                let { ProductSKUId, ProductId, quantity } = item;

                if (ProductSKUId) {
                    // Per-SKU check against SkuWarehouseStocks (source of truth)
                    const skuStock = await SkuWarehouseStock.findOne({
                        where: { ProductSKUId, WarehouseId },
                        transaction: t, lock: t.LOCK.UPDATE,
                    });
                    const available = skuStock ? Number(skuStock.qty) : 0;
                    if (available < Number(quantity)) {
                        await t.rollback();
                        return res.status(400).json({ message: `Stok tidak cukup di gudang yang dipilih (tersedia: ${available}, dibutuhkan: ${quantity})` });
                    }
                    const sku = await ProductSKU.findByPk(ProductSKUId, { transaction: t });
                    if (sku) await sku.decrement('qty', { by: Number(quantity), transaction: t });
                    await upsertSkuWarehouseStock(t, SkuWarehouseStock, { ProductSKUId, WarehouseId, delta: -Number(quantity), companyId: cid });
                } else {
                    const [stock] = await Stock.findOrCreate({
                        where: { ProductId, WarehouseId },
                        defaults: { quantity: 0, companyId: cid },
                        transaction: t,
                    });
                    const lockedStock = await Stock.findOne({ where: { ProductId, WarehouseId }, transaction: t, lock: t.LOCK.UPDATE });
                    const available = lockedStock ? Number(lockedStock.quantity) : 0;
                    if (available < Number(quantity)) {
                        await t.rollback();
                        return res.status(400).json({ message: `Stok tidak cukup di gudang yang dipilih (tersedia: ${available}, dibutuhkan: ${quantity})` });
                    }
                    await lockedStock.decrement('quantity', { by: Number(quantity), transaction: t });
                }

                // Keep Stocks table in sync (secondary)
                const stock = await Stock.findOne({ where: { ProductId, WarehouseId }, transaction: t });
                if (stock && ProductSKUId) {
                    const newQty = Math.max(0, Number(stock.quantity) - Number(quantity));
                    await stock.update({ quantity: newQty }, { transaction: t });
                }

                movements.push(await Stock_Movement.create({
                    ProductId,
                    ProductSKUId: ProductSKUId || null,
                    WarehouseId,
                    type: 'OUT',
                    quantity: Number(quantity),
                    ReferenceId: header.id,
                    source: 'STOCK_OUT',
                    date: date || new Date(),
                    companyId: cid,
                }, { transaction: t }));
            }

            // If this draft was staged from an approved pengajuan, finishing the
            // Stock Out is what triggers the next step: for Sales/Non-Sales that's
            // the Shipping Manual draft; for Jatah Internal (no shipping involved)
            // the Stock Out itself is the fulfillment, so the request goes straight to DONE.
            let manualShipmentId = null;
            if (draft.sourceRequestId) {
                const linkedRequest = await Request.findOne({
                    where: { id: draft.sourceRequestId },
                    include: [
                        { model: RequestType, as: 'requestType' },
                        {
                            model: RequestItem,
                            as: 'items',
                            include: [{
                                model: ProductSKU,
                                as: 'sku',
                                attributes: ['id', 'sku_code', 'price', 'qty', 'ProductId'],
                                include: [{ model: Product, attributes: ['id', 'name', 'imageUrl'] }],
                            }],
                        },
                    ],
                    transaction: t,
                });
                if (linkedRequest) {
                    const shipmentType = linkedRequest.requestType?.shipmentType;
                    if (shipmentType === 'sales' || shipmentType === 'non_sales') {
                        const shipment = await createShipmentFromRequest(linkedRequest, cid, req.user.id, t);
                        await linkedRequest.update({ manualShipmentId: shipment.id, stockOutDraftId: null }, { transaction: t });
                        manualShipmentId = shipment.id;
                    } else {
                        await linkedRequest.update({ status: 'DONE', processedBy: req.user.id, stockOutDraftId: null }, { transaction: t });
                    }
                }
            }

            await draft.destroy({ transaction: t });
            await t.commit();

            res.status(201).json({ ...header.toJSON(), movements, manualShipmentId });
        } catch (err) { await t.rollback(); next(err); }
    }

    static async cancel(req, res, next) {
        const t = await sequelize.transaction();
        try {
            const draft = await Stock_Out_Draft.findOne({
                where: { id: req.params.id, ...companyFilter(req) },
                transaction: t,
            });
            if (!draft) { await t.rollback(); throw { name: 'NotFound', message: 'Draft tidak ditemukan' }; }

            // Don't leave the originating Request pointing at a row we're about to
            // delete — clear the link so it can be re-processed (see requestController.approve).
            if (draft.sourceRequestId) {
                await Request.update(
                    { stockOutDraftId: null },
                    { where: { id: draft.sourceRequestId, stockOutDraftId: draft.id }, transaction: t }
                );
            }

            await draft.destroy({ transaction: t });
            await t.commit();
            res.status(200).json({ message: 'Draft dibatalkan' });
        } catch (err) { await t.rollback(); next(err); }
    }
}

module.exports = StockOutDraftController;
