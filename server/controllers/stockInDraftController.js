'use strict';
const {
    sequelize, Stock_In_Draft, Stock_In_Draft_Item,
    Stock_In_Header, Stock_In_Item, Stock_Movement, Stock,
    ProductSKU, Product, ProductVariantOption, ProductVariantType, Warehouse, User,
} = require('../models');
const { companyFilter, companyId } = require('../helpers/tenancy');

const DRAFT_ITEM_INCLUDE = [
    {
        model: Stock_In_Draft_Item,
        include: [{
            model: ProductSKU,
            attributes: ['id', 'sku_code', 'price', 'qty'],
            include: [
                { model: Product, attributes: ['id', 'name', 'imageUrl', 'unit'] },
                { model: ProductVariantOption, attributes: ['id', 'value'], through: { attributes: [] } },
            ],
        }],
    },
    { model: Warehouse, attributes: ['id', 'name'] },
];

async function findDraft(id, req) {
    const draft = await Stock_In_Draft.findOne({
        where: { id, ...companyFilter(req) },
        include: DRAFT_ITEM_INCLUDE,
    });
    if (!draft) throw { name: 'NotFound', message: 'Draft tidak ditemukan' };
    return draft;
}

class StockInDraftController {
    static async current(req, res, next) {
        try {
            const drafts = await Stock_In_Draft.findAll({
                where: { status: 'draft', createdBy: req.user.id, ...companyFilter(req) },
                include: DRAFT_ITEM_INCLUDE,
                order: [['createdAt', 'DESC']],
            });
            res.status(200).json(drafts);
        } catch (err) { next(err); }
    }

    static async get(req, res, next) {
        try {
            const draft = await Stock_In_Draft.findOne({
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
            let draft = await Stock_In_Draft.create({
                createdBy: req.user.id,
                companyId: cid,
                status: 'draft',
            });
            draft = await Stock_In_Draft.findOne({
                where: { id: draft.id },
                include: DRAFT_ITEM_INCLUDE,
            });
            res.status(201).json(draft);
        } catch (err) { next(err); }
    }

    static async ensure(req, res, next) {
        try {
            const cid = companyId(req);
            let draft = await Stock_In_Draft.findOne({
                where: { status: 'draft', createdBy: req.user.id, ...companyFilter(req) },
                include: DRAFT_ITEM_INCLUDE,
            });
            if (!draft) {
                draft = await Stock_In_Draft.create({
                    createdBy: req.user.id,
                    companyId: cid,
                    status: 'draft',
                });
                draft = await Stock_In_Draft.findOne({
                    where: { id: draft.id },
                    include: DRAFT_ITEM_INCLUDE,
                });
            }
            res.status(200).json(draft);
        } catch (err) { next(err); }
    }

    static async update(req, res, next) {
        try {
            const draft = await Stock_In_Draft.findOne({
                where: { id: req.params.id, createdBy: req.user.id, ...companyFilter(req) },
            });
            if (!draft) throw { name: 'NotFound', message: 'Draft tidak ditemukan' };

            const updates = {};
            if (req.body.WarehouseId !== undefined) updates.WarehouseId = req.body.WarehouseId;
            if (req.body.date        !== undefined) updates.date        = req.body.date;
            if (req.body.note        !== undefined) updates.note        = req.body.note;
            await draft.update(updates);

            const result = await Stock_In_Draft.findOne({
                where: { id: draft.id },
                include: DRAFT_ITEM_INCLUDE,
            });
            res.status(200).json(result);
        } catch (err) { next(err); }
    }

    static async addItem(req, res, next) {
        try {
            const draft = await Stock_In_Draft.findOne({
                where: { id: req.params.id, status: 'draft', ...companyFilter(req) },
            });
            if (!draft) throw { name: 'NotFound', message: 'Draft tidak ditemukan atau sudah disubmit' };

            const { ProductSKUId, quantity = 1, price } = req.body;
            const cid = companyId(req);

            const existing = await Stock_In_Draft_Item.findOne({
                where: { DraftId: draft.id, ProductSKUId },
            });

            if (existing) {
                await existing.increment('quantity', { by: Number(quantity) });
                await existing.reload(); // flush increment ke in-memory instance
                if (price !== undefined) await existing.update({ price: Number(price) });
            } else {
                await Stock_In_Draft_Item.create({
                    DraftId: draft.id,
                    ProductSKUId,
                    quantity: Number(quantity),
                    price: Number(price) || 0,
                    companyId: cid,
                });
            }

            const result = await Stock_In_Draft.findOne({
                where: { id: draft.id },
                include: DRAFT_ITEM_INCLUDE,
            });
            res.status(200).json(result);
        } catch (err) { next(err); }
    }

    static async updateItem(req, res, next) {
        try {
            const item = await Stock_In_Draft_Item.findOne({
                where: { id: req.params.itemId, DraftId: req.params.id },
            });
            if (!item) throw { name: 'NotFound', message: 'Item tidak ditemukan' };

            const updates = {};
            if (req.body.quantity !== undefined) updates.quantity = Number(req.body.quantity);
            if (req.body.price    !== undefined) updates.price    = Number(req.body.price);
            await item.update(updates);
            res.status(200).json(item);
        } catch (err) { next(err); }
    }

    static async removeItem(req, res, next) {
        try {
            const item = await Stock_In_Draft_Item.findOne({
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
            const draft = await Stock_In_Draft.findOne({
                where: { id: req.params.id, ...companyFilter(req) },
                include: DRAFT_ITEM_INCLUDE,
                transaction: t,
            });
            if (!draft) { await t.rollback(); throw { name: 'NotFound', message: 'Draft tidak ditemukan' }; }

            const WarehouseId = req.body.WarehouseId || draft.WarehouseId;
            const date        = req.body.date        || draft.date;
            const note        = req.body.note        !== undefined ? req.body.note : draft.note;

            if (!WarehouseId) {
                await t.rollback();
                return res.status(400).json({ message: 'WarehouseId wajib dipilih' });
            }

            const items = draft.Stock_In_Draft_Items || [];
            if (!items.length) {
                await t.rollback();
                return res.status(400).json({ message: 'Draft tidak memiliki item' });
            }

            const cid = companyId(req);

            const header = await Stock_In_Header.create({
                date: date || new Date(),
                WarehouseId,
                note: note || null,
                createdBy: req.user.id,
                companyId: cid,
            }, { transaction: t });

            for (const item of items) {
                const { ProductSKUId, quantity, price } = item;

                await Stock_In_Item.create({
                    StockInHeaderId: header.id,
                    ProductSKUId,
                    quantity: Number(quantity),
                    price: Number(price) || 0,
                    companyId: cid,
                }, { transaction: t });

                const sku = await ProductSKU.findByPk(ProductSKUId, { transaction: t });
                if (sku) {
                    const [stock] = await Stock.findOrCreate({
                        where: { ProductId: sku.ProductId, WarehouseId },
                        defaults: { quantity: 0, companyId: cid },
                        transaction: t,
                    });
                    await stock.increment('quantity', { by: Number(quantity), transaction: t });
                    await sku.increment('qty', { by: Number(quantity), transaction: t });
                    await Stock_Movement.create({
                        ProductId: sku.ProductId,
                        ProductSKUId: Number(ProductSKUId),
                        WarehouseId,
                        type: 'IN',
                        quantity: Number(quantity),
                        ReferenceId: header.id,
                        date: date || new Date(),
                        companyId: cid,
                    }, { transaction: t });
                }
            }

            await draft.destroy({ transaction: t });
            await t.commit();

            const result = await Stock_In_Header.findByPk(header.id, {
                include: [
                    { model: Warehouse, attributes: ['id', 'name'] },
                    { model: User, foreignKey: 'createdBy', attributes: ['id', 'name'] },
                    {
                        model: Stock_In_Item,
                        include: [{
                            model: ProductSKU,
                            attributes: ['id', 'sku_code', 'price', 'qty'],
                            include: [
                                { model: Product, attributes: ['id', 'name', 'imageUrl', 'unit'] },
                                { model: ProductVariantOption, attributes: ['id', 'value'], through: { attributes: [] } },
                            ],
                        }],
                    },
                ],
            });
            const plain = result.toJSON();
            const grandTotal = (plain.Stock_In_Items ?? []).reduce((s, i) => s + Number(i.price) * i.quantity, 0);
            res.status(201).json({ ...plain, grandTotal });
        } catch (err) { await t.rollback(); next(err); }
    }

    static async cancel(req, res, next) {
        try {
            const draft = await Stock_In_Draft.findOne({
                where: { id: req.params.id, createdBy: req.user.id, ...companyFilter(req) },
            });
            if (!draft) throw { name: 'NotFound', message: 'Draft tidak ditemukan' };
            await draft.destroy();
            res.status(200).json({ message: 'Draft dibatalkan' });
        } catch (err) { next(err); }
    }
}

module.exports = StockInDraftController;
