'use strict';
const { Op } = require('sequelize');
const {
  sequelize, Stock_In_Header, Stock_In_Item, Stock_Movement, Stock, SkuWarehouseStock,
  Supplier, Warehouse, User, ProductSKU, Product, ProductVariantOption, ProductVariantType,
} = require('../models');
const { upsertSkuWarehouseStock } = require('../helpers/skuStock');
const { companyFilter, companyId } = require('../helpers/tenancy');
const { paginate, buildFilter, paginatedResponse } = require('../helpers/queryHelper');

// Full SKU include tree (photo + variant labels)
const SKU_INCLUDE = [
  {
    model: ProductSKU,
    attributes: ['id', 'sku_code', 'price', 'qty'],
    include: [
      { model: Product, attributes: ['id', 'name', 'imageUrl', 'unit'] },
      {
        model: ProductVariantOption,
        attributes: ['id', 'value'],
        through: { attributes: [] },
        include: [{ model: ProductVariantType, attributes: ['id', 'name'] }],
      },
    ],
  },
];

class StockInHeaderController {
  static async getAll(req, res, next) {
    try {
      const { page, limit, offset } = paginate(req.query);
      const filter = buildFilter(req.query, {
        SupplierId:  'exact',
        WarehouseId: 'exact',
        dateFrom:    { field: 'date', type: 'gte' },
        dateTo:      { field: 'date', type: 'lte' },
      });
      // Search umum: nama supplier + nama produk di dalam item.
      // Search catatan terpisah (item stock in tidak punya kolom catatan).
      const extra = [];
      if (req.query.search) {
        const term = sequelize.escape(`%${req.query.search}%`);
        extra.push({
          [Op.or]: [
            sequelize.literal(`"Stock_In_Header"."SupplierId" IN (SELECT id FROM "Suppliers" WHERE "name" ILIKE ${term})`),
            sequelize.literal(`"Stock_In_Header"."id" IN (SELECT sii."StockInHeaderId" FROM "Stock_In_Items" sii JOIN "ProductSKUs" ps ON sii."ProductSKUId" = ps.id JOIN "Products" p ON ps."ProductId" = p.id WHERE p."name" ILIKE ${term})`),
          ],
        });
      }
      if (req.query.noteSearch) {
        extra.push({ note: { [Op.iLike]: `%${req.query.noteSearch}%` } });
      }

      const { rows, count } = await Stock_In_Header.findAndCountAll({
        where: { ...companyFilter(req), ...filter, ...(extra.length && { [Op.and]: extra }) },
        include: [
          { model: Supplier,  attributes: ['id', 'name'] },
          { model: Warehouse, attributes: ['id', 'name'] },
          { model: User,      foreignKey: 'createdBy', attributes: ['id', 'name'] },
          { model: User,      foreignKey: 'updatedBy', as: 'updater', attributes: ['id', 'name'] },
          { model: Stock_In_Item, attributes: ['id', 'quantity', 'price'] },
        ],
        order: [['date', 'DESC'], ['id', 'DESC']],
        limit, offset,
        distinct: true,
      });

      const enriched = rows.map(r => {
        const plain = r.toJSON();
        const itemCount  = plain.Stock_In_Items?.length ?? 0;
        const totalQty   = (plain.Stock_In_Items ?? []).reduce((s, i) => s + i.quantity, 0);
        const grandTotal = (plain.Stock_In_Items ?? []).reduce((s, i) => s + Number(i.price) * i.quantity, 0);
        return { ...plain, itemCount, totalQty, grandTotal };
      });

      res.status(200).json(paginatedResponse(enriched, count, page, limit));
    } catch (err) { next(err); }
  }

  static async getById(req, res, next) {
    try {
      const header = await Stock_In_Header.findOne({
        where: { id: req.params.id, ...companyFilter(req) },
        include: [
          { model: Supplier,  attributes: ['id', 'name'] },
          { model: Warehouse, attributes: ['id', 'name'] },
          { model: User, foreignKey: 'createdBy', attributes: ['id', 'name'] },
          { model: User, foreignKey: 'updatedBy', as: 'updater', attributes: ['id', 'name'] },
          {
            model: Stock_In_Item,
            include: SKU_INCLUDE,
          },
        ],
      });
      if (!header) throw { name: 'NotFound', message: 'Stock in not found' };

      const plain = header.toJSON();
      const grandTotal = (plain.Stock_In_Items ?? []).reduce((s, i) => s + Number(i.price) * i.quantity, 0);
      res.status(200).json({ ...plain, grandTotal });
    } catch (err) { next(err); }
  }

  static async create(req, res, next) {
    const t = await sequelize.transaction();
    try {
      const { items = [], date, SupplierId, WarehouseId, note } = req.body;
      const cid = companyId(req);

      if (!WarehouseId) {
        await t.rollback();
        return res.status(400).json({ message: 'WarehouseId wajib dipilih' });
      }

      const header = await Stock_In_Header.create({
        date: date || new Date(),
        SupplierId: SupplierId || null,
        WarehouseId,
        note: note || null,
        createdBy: req.user.id,
        companyId: cid,
      }, { transaction: t });

      for (const item of items) {
        const { ProductSKUId, quantity, price } = item;
        if (!ProductSKUId || !quantity || quantity <= 0) {
          await t.rollback();
          return res.status(400).json({ message: 'Setiap item butuh ProductSKUId dan quantity > 0' });
        }

        await Stock_In_Item.create({
          StockInHeaderId: header.id,
          ProductSKUId,
          quantity: Number(quantity),
          price: Number(price) || 0,
          companyId: cid,
        }, { transaction: t });

        // Upsert stock (warehouse-level — single source of truth)
        const sku = await ProductSKU.findByPk(ProductSKUId, { transaction: t });
        if (sku) {
          const [stock] = await Stock.findOrCreate({
            where: { ProductId: sku.ProductId, WarehouseId },
            defaults: { quantity: 0, companyId: cid },
            transaction: t,
          });
          await stock.increment('quantity', { by: Number(quantity), transaction: t });
          await sku.increment('qty', { by: Number(quantity), transaction: t });
          await upsertSkuWarehouseStock(t, SkuWarehouseStock, { ProductSKUId: Number(ProductSKUId), WarehouseId, delta: Number(quantity), companyId: cid });

          await Stock_Movement.create({
            ProductId: sku.ProductId, ProductSKUId: Number(ProductSKUId), WarehouseId,
            type: 'IN', quantity: Number(quantity),
            ReferenceId: header.id, source: 'STOCK_IN', note: note || null,
            date: header.date || new Date(),
            companyId: cid,
          }, { transaction: t });
        }
      }

      await t.commit();
      const result = await Stock_In_Header.findByPk(header.id, {
        include: [
          { model: Supplier,  attributes: ['id', 'name'] },
          { model: Warehouse, attributes: ['id', 'name'] },
          { model: Stock_In_Item, include: SKU_INCLUDE },
        ],
      });
      const plain = result.toJSON();
      const grandTotal = (plain.Stock_In_Items ?? []).reduce((s, i) => s + Number(i.price) * i.quantity, 0);
      res.status(201).json({ ...plain, grandTotal });
    } catch (err) { await t.rollback(); next(err); }
  }

  static async update(req, res, next) {
    try {
      const header = await Stock_In_Header.findOne({ where: { id: req.params.id, ...companyFilter(req) } });
      if (!header) throw { name: 'NotFound', message: 'Stock in not found' };
      // WarehouseId changes are blocked — moving stock requires delete + recreate
      if (req.body.WarehouseId && Number(req.body.WarehouseId) !== header.WarehouseId) {
        return res.status(400).json({ message: 'Gudang tidak dapat diubah. Hapus dan buat ulang dokumen untuk mengganti gudang.' });
      }
      const { date, SupplierId, note } = req.body;
      await header.update({ date, SupplierId, note, updatedBy: req.user.id });
      res.status(200).json(header);
    } catch (err) { next(err); }
  }

  static async delete(req, res, next) {
    const t = await sequelize.transaction();
    try {
      const header = await Stock_In_Header.findOne({
        where: { id: req.params.id, ...companyFilter(req) },
        include: [{ model: Stock_In_Item }],
        transaction: t,
      });
      if (!header) { await t.rollback(); throw { name: 'NotFound', message: 'Stock in not found' }; }

      for (const item of (header.Stock_In_Items || [])) {
        const sku = await ProductSKU.findByPk(item.ProductSKUId, { transaction: t });
        if (sku) {
          const stock = await Stock.findOne({
            where: { ProductId: sku.ProductId, WarehouseId: header.WarehouseId },
            transaction: t,
          });
          if (stock) await stock.decrement('quantity', { by: item.quantity, transaction: t });
          await sku.decrement('qty', { by: item.quantity, transaction: t });
          await upsertSkuWarehouseStock(t, SkuWarehouseStock, { ProductSKUId: item.ProductSKUId, WarehouseId: header.WarehouseId, delta: -item.quantity, companyId: sku.companyId });
        }
      }
      await Stock_Movement.destroy({ where: { ReferenceId: header.id }, transaction: t });
      await header.destroy({ transaction: t });
      await t.commit();
      res.status(200).json({ message: 'Deleted' });
    } catch (err) { await t.rollback(); next(err); }
  }

  // ── Item sub-routes ──────────────────────────────────────────────────────────

  static async addItem(req, res, next) {
    const t = await sequelize.transaction();
    try {
      const header = await Stock_In_Header.findOne({ where: { id: req.params.id, ...companyFilter(req) } });
      if (!header) throw { name: 'NotFound', message: 'Stock in not found' };

      const { ProductSKUId, quantity, price } = req.body;
      if (!ProductSKUId || !quantity || quantity <= 0) {
        await t.rollback();
        return res.status(400).json({ message: 'ProductSKUId dan quantity > 0 wajib diisi' });
      }

      const cid = companyId(req);
      const item = await Stock_In_Item.create({
        StockInHeaderId: header.id,
        ProductSKUId,
        quantity: Number(quantity),
        price: Number(price) || 0,
        companyId: cid,
      }, { transaction: t });

      const sku = await ProductSKU.findByPk(ProductSKUId, { transaction: t });
      if (sku) {
        const [stock] = await Stock.findOrCreate({
          where: { ProductId: sku.ProductId, WarehouseId: header.WarehouseId },
          defaults: { quantity: 0, companyId: cid },
          transaction: t,
        });
        await stock.increment('quantity', { by: Number(quantity), transaction: t });
        await sku.increment('qty', { by: Number(quantity), transaction: t });
        await upsertSkuWarehouseStock(t, SkuWarehouseStock, { ProductSKUId: Number(ProductSKUId), WarehouseId: header.WarehouseId, delta: Number(quantity), companyId: cid });
        await Stock_Movement.create({
          ProductId: sku.ProductId, ProductSKUId: Number(ProductSKUId), WarehouseId: header.WarehouseId,
          type: 'IN', quantity: Number(quantity),
          ReferenceId: header.id, source: 'STOCK_IN',
          date: header.date || new Date(),
          companyId: cid,
        }, { transaction: t });
      }

      await header.update({ updatedBy: req.user.id }, { transaction: t });
      await t.commit();
      const full = await Stock_In_Item.findByPk(item.id, { include: SKU_INCLUDE });
      res.status(201).json(full);
    } catch (err) { await t.rollback(); next(err); }
  }

  static async updateItem(req, res, next) {
    const t = await sequelize.transaction();
    try {
      const item = await Stock_In_Item.findOne({
        where: { id: req.params.itemId, StockInHeaderId: req.params.id },
        transaction: t,
      });
      if (!item) { await t.rollback(); throw { name: 'NotFound', message: 'Item not found' }; }

      const header = await Stock_In_Header.findByPk(req.params.id, { transaction: t });

      const newQty   = req.body.quantity != null ? Number(req.body.quantity) : item.quantity;
      const newPrice = req.body.price    != null ? Number(req.body.price)    : item.price;
      const delta    = newQty - item.quantity;

      await item.update({ quantity: newQty, price: newPrice }, { transaction: t });

      if (delta !== 0 && header) {
        const sku = await ProductSKU.findByPk(item.ProductSKUId, { transaction: t });
        if (sku) {
          const [stock] = await Stock.findOrCreate({
            where: { ProductId: sku.ProductId, WarehouseId: header.WarehouseId },
            defaults: { quantity: 0, companyId: companyId(req) },
            transaction: t,
          });
          await stock.increment('quantity', { by: delta, transaction: t });
          await sku.increment('qty', { by: delta, transaction: t });
          await upsertSkuWarehouseStock(t, SkuWarehouseStock, { ProductSKUId: item.ProductSKUId, WarehouseId: header.WarehouseId, delta, companyId: companyId(req) });
          await Stock_Movement.create({
            ProductId: sku.ProductId, ProductSKUId: item.ProductSKUId, WarehouseId: header.WarehouseId,
            type: delta > 0 ? 'IN' : 'OUT', quantity: Math.abs(delta),
            ReferenceId: header.id, source: 'STOCK_IN',
            date: header.date || new Date(),
            companyId: companyId(req),
          }, { transaction: t });
        }
      }

      await t.commit();
      const full = await Stock_In_Item.findByPk(item.id, { include: SKU_INCLUDE });
      res.status(200).json(full);
    } catch (err) { await t.rollback(); next(err); }
  }

  static async removeItem(req, res, next) {
    const t = await sequelize.transaction();
    try {
      const item = await Stock_In_Item.findOne({
        where: { id: req.params.itemId, StockInHeaderId: req.params.id },
        transaction: t,
      });
      if (!item) { await t.rollback(); throw { name: 'NotFound', message: 'Item not found' }; }

      const header = await Stock_In_Header.findByPk(req.params.id, { transaction: t });
      if (header) {
        const sku = await ProductSKU.findByPk(item.ProductSKUId, { transaction: t });
        if (sku) {
          const stock = await Stock.findOne({
            where: { ProductId: sku.ProductId, WarehouseId: header.WarehouseId },
            transaction: t,
          });
          if (stock) {
            await stock.decrement('quantity', { by: item.quantity, transaction: t });
          }
          await sku.decrement('qty', { by: item.quantity, transaction: t });
          await upsertSkuWarehouseStock(t, SkuWarehouseStock, { ProductSKUId: item.ProductSKUId, WarehouseId: header.WarehouseId, delta: -item.quantity, companyId: sku.companyId });
          await Stock_Movement.create({
            ProductId: sku.ProductId, ProductSKUId: item.ProductSKUId, WarehouseId: header.WarehouseId,
            type: 'OUT', quantity: item.quantity,
            ReferenceId: header.id, source: 'STOCK_IN',
            note: `Koreksi: item dihapus dari Stock IN #${header.id}`,
            date: header.date || new Date(),
            companyId: companyId(req),
          }, { transaction: t });
        }
      }

      await item.destroy({ transaction: t });
      if (header) await header.update({ updatedBy: req.user.id }, { transaction: t });
      await t.commit();
      res.status(200).json({ message: 'Item removed' });
    } catch (err) { await t.rollback(); next(err); }
  }

  // Resolve a SKU by sku_code (for scan flow)
  static async resolveSku(req, res, next) {
    try {
      const { code } = req.query;
      if (!code) return res.status(400).json({ message: 'code query param required' });
      const cid = req.user.role === 'SUPER_ADMIN' ? undefined : req.user.companyId;
      const sku = await ProductSKU.findOne({
        where: { sku_code: code, ...(cid != null ? { companyId: cid } : {}) },
        include: [
          { model: Product, attributes: ['id', 'name', 'imageUrl', 'unit'] },
          {
            model: ProductVariantOption,
            attributes: ['id', 'value'],
            through: { attributes: [] },
            include: [{ model: ProductVariantType, attributes: ['id', 'name'] }],
          },
        ],
      });
      if (!sku) return res.status(404).json({ message: `SKU "${code}" tidak ditemukan` });
      res.status(200).json(sku);
    } catch (err) { next(err); }
  }
}

module.exports = StockInHeaderController;
