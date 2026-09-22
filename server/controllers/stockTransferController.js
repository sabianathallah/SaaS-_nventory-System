'use strict';
const {
  sequelize, StockTransfer, StockTransferItem,
  Stock_Movement, Stock, SkuWarehouseStock, ProductSKU, Product,
  Warehouse, User, ProductVariantOption, ProductVariantType,
} = require('../models');
const { companyFilter, companyId: getCompanyId } = require('../helpers/tenancy');
const { moveSkuWarehouseStock } = require('../helpers/skuStock');

const VALID_TYPES = ['TRANSFER', 'QC_REJECT_SEMENTARA', 'QC_REJECT_PERMANEN', 'LAINNYA'];

const SKU_INCLUDE = {
  model: ProductSKU,
  as: 'ProductSKU',
  attributes: ['id', 'sku_code', 'qty'],
  include: [
    { model: Product, attributes: ['id', 'name', 'unit'] },
    {
      model: ProductVariantOption,
      attributes: ['value'],
      through: { attributes: [] },
      include: [{ model: ProductVariantType, attributes: ['name'] }],
    },
  ],
};

const HEADER_INCLUDE = [
  { model: Warehouse, as: 'FromWarehouse', attributes: ['id', 'name'] },
  { model: Warehouse, as: 'ToWarehouse',   attributes: ['id', 'name'] },
  { model: User,      as: 'Creator',       attributes: ['id', 'name'] },
  { model: User,      as: 'updater',       attributes: ['id', 'name'] },
];

async function applyItem(t, { cid, fromWarehouseId, toWarehouseId, productSkuId, qty, transferId, date, note }) {
  const sku = await ProductSKU.findByPk(productSkuId, { transaction: t });
  if (!sku) throw { status: 404, message: `SKU ${productSkuId} tidak ditemukan` };

  // Per-SKU check against SkuWarehouseStocks (source of truth) — lock row to prevent
  // concurrent transfers from racing past the sufficiency check. Stock (legacy) is
  // product-level only, so it can't tell variants apart and must not gate this check.
  const srcSkuStock = await SkuWarehouseStock.findOne({
    where: { ProductSKUId: productSkuId, WarehouseId: fromWarehouseId },
    transaction: t, lock: t.LOCK.UPDATE,
  });
  const availableSku = srcSkuStock ? Number(srcSkuStock.qty) : 0;
  if (availableSku < qty) {
    throw { status: 400, message: `Stok tidak cukup di gudang asal untuk SKU ${sku.sku_code} (tersedia: ${availableSku})` };
  }
  await moveSkuWarehouseStock(t, SkuWarehouseStock, { ProductSKUId: productSkuId, fromWarehouseId, toWarehouseId, qty, companyId: cid });

  // Keep legacy Stock (product-level aggregate) table in sync — secondary, non-blocking
  const srcStock = await Stock.findOne({ where: { ProductId: sku.ProductId, WarehouseId: fromWarehouseId }, transaction: t, lock: t.LOCK.UPDATE });
  if (srcStock) {
    const newQty = Math.max(0, Number(srcStock.quantity) - qty);
    await srcStock.update({ quantity: newQty }, { transaction: t });
  }
  const [dstStock] = await Stock.findOrCreate({
    where: { ProductId: sku.ProductId, WarehouseId: toWarehouseId },
    defaults: { quantity: 0, companyId: cid },
    transaction: t,
  });
  await dstStock.increment('quantity', { by: qty, transaction: t });

  // Create paired movements
  const movBase = { ProductId: sku.ProductId, ProductSKUId: productSkuId, ReferenceId: transferId, source: 'TRANSFER', date, companyId: cid, note };
  await Stock_Movement.create({ ...movBase, WarehouseId: fromWarehouseId, type: 'OUT', quantity: qty }, { transaction: t });
  await Stock_Movement.create({ ...movBase, WarehouseId: toWarehouseId,   type: 'IN',  quantity: qty }, { transaction: t });

  return await StockTransferItem.create({ transferId, productSkuId, quantity: qty }, { transaction: t });
}

async function reverseItem(t, { cid, fromWarehouseId, toWarehouseId, productSkuId, qty }) {
  const sku = await ProductSKU.findByPk(productSkuId, { transaction: t });
  if (!sku) return;

  // Restore source stock — verify the row exists so we don't silently lose the reversal
  const srcStock = await Stock.findOne({ where: { ProductId: sku.ProductId, WarehouseId: fromWarehouseId }, transaction: t });
  if (srcStock) {
    await srcStock.increment('quantity', { by: qty, transaction: t });
  } else {
    // Row was deleted after transfer — recreate it so stock isn't permanently lost
    await Stock.create({ ProductId: sku.ProductId, WarehouseId: fromWarehouseId, quantity: qty, companyId: cid }, { transaction: t });
  }

  // Decrement destination — clamp to 0 to avoid negative stock (units may have been consumed)
  const dstStock = await Stock.findOne({ where: { ProductId: sku.ProductId, WarehouseId: toWarehouseId }, transaction: t });
  if (dstStock) {
    const deductable = Math.min(qty, Number(dstStock.quantity));
    if (deductable > 0) await dstStock.decrement('quantity', { by: deductable, transaction: t });
  }

  // Reverse SkuWarehouseStocks: move back from toWarehouse to fromWarehouse — clamp to what's
  // actually still there so a SKU consumed since the transfer (sold, transferred again, etc.)
  // can't be pushed negative.
  const dstSkuStock = await SkuWarehouseStock.findOne({
    where: { ProductSKUId: productSkuId, WarehouseId: toWarehouseId },
    transaction: t, lock: t.LOCK.UPDATE,
  });
  const reversible = Math.min(qty, dstSkuStock ? Number(dstSkuStock.qty) : 0);
  if (reversible > 0) {
    await moveSkuWarehouseStock(t, SkuWarehouseStock, { ProductSKUId: productSkuId, fromWarehouseId: toWarehouseId, toWarehouseId: fromWarehouseId, qty: reversible, companyId: cid });
  }
}

exports.list = async (req, res, next) => {
  try {
    const { page = 1, limit = 15 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    const { rows, count } = await StockTransfer.findAndCountAll({
      where: companyFilter(req),
      include: [...HEADER_INCLUDE, { model: StockTransferItem, as: 'items', attributes: ['id'] }],
      order: [['date', 'DESC'], ['createdAt', 'DESC']],
      limit: Number(limit),
      offset,
      distinct: true,
    });
    const data = rows.map(r => ({ ...r.toJSON(), itemCount: r.items?.length ?? 0, items: undefined }));
    res.json({ data, pagination: { total: count, page: Number(page), limit: Number(limit), totalPages: Math.ceil(count / Number(limit)) } });
  } catch (err) { next(err); }
};

exports.get = async (req, res, next) => {
  try {
    const row = await StockTransfer.findOne({
      where: { id: req.params.id, ...companyFilter(req) },
      include: [...HEADER_INCLUDE, { model: StockTransferItem, as: 'items', include: [SKU_INCLUDE] }],
    });
    if (!row) return res.status(404).json({ message: 'Transfer tidak ditemukan' });
    res.json({ data: row });
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    const { fromWarehouseId, toWarehouseId, transferType = 'TRANSFER', note, date, items = [] } = req.body;
    if (!fromWarehouseId)                        throw { status: 400, message: 'Gudang asal wajib dipilih' };
    if (!toWarehouseId)                          throw { status: 400, message: 'Gudang tujuan wajib dipilih' };
    if (fromWarehouseId === toWarehouseId)        throw { status: 400, message: 'Gudang asal dan tujuan tidak boleh sama' };
    if (!date)                                   throw { status: 400, message: 'Tanggal wajib diisi' };
    if (!VALID_TYPES.includes(transferType))     throw { status: 400, message: 'Tipe transfer tidak valid' };
    if (!items.length)                           throw { status: 400, message: 'Minimal satu item diperlukan' };

    const cid = getCompanyId(req);
    const transfer = await StockTransfer.create({
      companyId: cid, fromWarehouseId, toWarehouseId,
      transferType, note: note?.trim() || null,
      date, createdBy: req.user.id,
    }, { transaction: t });

    for (const item of items) {
      const qty = Number(item.qty || item.quantity);
      if (!item.productSkuId || qty <= 0) throw { status: 400, message: 'Setiap item butuh productSkuId dan qty > 0' };
      await applyItem(t, { cid, fromWarehouseId, toWarehouseId, productSkuId: item.productSkuId, qty, transferId: transfer.id, date, note: note?.trim() || null });
    }

    await t.commit();
    const result = await StockTransfer.findByPk(transfer.id, {
      include: [...HEADER_INCLUDE, { model: StockTransferItem, as: 'items', include: [SKU_INCLUDE] }],
    });
    res.status(201).json({ data: result });
  } catch (err) { await t.rollback(); err.status ? res.status(err.status).json({ message: err.message }) : next(err); }
};

exports.destroy = async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    const transfer = await StockTransfer.findOne({
      where: { id: req.params.id, ...companyFilter(req) },
      include: [{ model: StockTransferItem, as: 'items' }],
      transaction: t,
    });
    if (!transfer) { await t.rollback(); return res.status(404).json({ message: 'Transfer tidak ditemukan' }); }

    const cid = getCompanyId(req);
    for (const item of transfer.items) {
      await reverseItem(t, {
        cid, fromWarehouseId: transfer.fromWarehouseId, toWarehouseId: transfer.toWarehouseId,
        productSkuId: item.productSkuId, qty: item.quantity,
      });
    }

    await Stock_Movement.destroy({ where: { source: 'TRANSFER', ReferenceId: transfer.id }, transaction: t });
    await transfer.destroy({ transaction: t });
    await t.commit();
    res.json({ message: 'Transfer dihapus dan stok dikembalikan' });
  } catch (err) { await t.rollback(); err.status ? res.status(err.status).json({ message: err.message }) : next(err); }
};
