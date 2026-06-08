'use strict';
const {
    sequelize, Stock_Out_Draft, Stock_Out_Draft_Item,
    Stock_Out_Header, Stock_Movement, Stock,
    ProductSKU, Product, ProductVariantOption, Warehouse, User,
} = require('../models');
const { companyFilter, companyId } = require('../helpers/tenancy');

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
                where: { status: 'draft', createdBy: req.user.id, ...companyFilter(req) },
                include: DRAFT_ITEM_INCLUDE,
                order: [['createdAt', 'DESC']],
            });
            res.status(200).json(drafts);
        } catch (err) { next(err); }
    }

    static async get(req, res, next) {
        try {
            const draft = await Stock_Out_Draft.findOne({
                where: { id: req.params.id, createdBy: req.user.id, ...companyFilter(req) },
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
                where: { id: req.params.id, createdBy: req.user.id, ...companyFilter(req) },
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

            const movements = [];
            for (const item of items) {
                let { ProductSKUId, ProductId, quantity } = item;

                // Resolve ProductId from SKU if not stored
                if (!ProductId && ProductSKUId) {
                    const sku = await ProductSKU.findByPk(ProductSKUId, { transaction: t });
                    if (sku) ProductId = sku.ProductId;
                }

                if (!ProductId) continue;

                await Stock.findOrCreate({
                    where: { ProductId, WarehouseId },
                    defaults: { quantity: 0, companyId: cid },
                    transaction: t,
                });

                const stock = await Stock.findOne({ where: { ProductId, WarehouseId }, transaction: t });
                await stock.decrement('quantity', { by: Number(quantity), transaction: t });

                if (ProductSKUId) {
                    const sku = await ProductSKU.findByPk(ProductSKUId, { transaction: t });
                    if (sku) await sku.decrement('qty', { by: Number(quantity), transaction: t });
                }

                movements.push(await Stock_Movement.create({
                    ProductId,
                    ProductSKUId: ProductSKUId || null,
                    WarehouseId,
                    type: 'OUT',
                    quantity: Number(quantity),
                    ReferenceId: header.id,
                    date: date || new Date(),
                    companyId: cid,
                }, { transaction: t }));
            }

            await draft.destroy({ transaction: t });
            await t.commit();

            res.status(201).json({ ...header.toJSON(), movements });
        } catch (err) { await t.rollback(); next(err); }
    }

    static async cancel(req, res, next) {
        try {
            const draft = await Stock_Out_Draft.findOne({
                where: { id: req.params.id, createdBy: req.user.id, ...companyFilter(req) },
            });
            if (!draft) throw { name: 'NotFound', message: 'Draft tidak ditemukan' };
            await draft.destroy();
            res.status(200).json({ message: 'Draft dibatalkan' });
        } catch (err) { next(err); }
    }
}

module.exports = StockOutDraftController;
