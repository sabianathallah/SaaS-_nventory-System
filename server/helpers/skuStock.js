'use strict';

/**
 * Upsert SkuWarehouseStock: create row if not exists, then increment/decrement qty.
 * delta > 0 = stock in, delta < 0 = stock out.
 */
async function upsertSkuWarehouseStock(t, SkuWarehouseStock, { ProductSKUId, WarehouseId, delta, companyId }) {
  if (!ProductSKUId || !WarehouseId || delta === 0) return;
  const [row] = await SkuWarehouseStock.findOrCreate({
    where: { ProductSKUId, WarehouseId },
    defaults: { qty: 0, companyId },
    transaction: t,
  });
  if (delta > 0) {
    await row.increment('qty', { by: delta, transaction: t });
  } else {
    await row.decrement('qty', { by: Math.abs(delta), transaction: t });
  }
  // Keep the legacy product-level Stocks row derived from the SKU ledger.
  const { ProductSKU } = require('../models');
  const sku = await ProductSKU.findByPk(ProductSKUId, { attributes: ['id', 'ProductId'], transaction: t });
  if (sku) await syncLegacyStock(t, { ProductId: sku.ProductId, WarehouseId, companyId });
}

/**
 * Move qty from one warehouse to another (for stock transfers).
 */
async function moveSkuWarehouseStock(t, SkuWarehouseStock, { ProductSKUId, fromWarehouseId, toWarehouseId, qty, companyId }) {
  await upsertSkuWarehouseStock(t, SkuWarehouseStock, { ProductSKUId, WarehouseId: fromWarehouseId, delta: -qty, companyId });
  await upsertSkuWarehouseStock(t, SkuWarehouseStock, { ProductSKUId, WarehouseId: toWarehouseId,   delta:  qty, companyId });
}

/**
 * Recompute the legacy product-level "Stocks" row for one product in one warehouse from
 * SkuWarehouseStocks (the source of truth). Call it AFTER the SKU-level change, inside the
 * same transaction, instead of incrementing/decrementing Stocks by hand — hand-kept deltas
 * clamped at 0 and drifted once a warehouse went minus.
 * Products without SKUs are left alone: for them Stocks is still the only ledger.
 */
async function syncLegacyStock(t, { ProductId, WarehouseId, companyId }) {
  if (!ProductId || !WarehouseId) return;
  const { sequelize, Stock } = require('../models');
  const [row] = await sequelize.query(
    `SELECT COUNT(ps."id")::int AS "skuCount", COALESCE(SUM(sws."qty"), 0)::int AS "qty"
       FROM "ProductSKUs" ps
       LEFT JOIN "SkuWarehouseStocks" sws ON sws."ProductSKUId" = ps."id" AND sws."WarehouseId" = :WarehouseId
      WHERE ps."ProductId" = :ProductId`,
    { replacements: { ProductId, WarehouseId }, type: sequelize.QueryTypes.SELECT, transaction: t },
  );
  if (!row || !row.skuCount) return;
  const [stock] = await Stock.findOrCreate({
    where: { ProductId, WarehouseId },
    defaults: { quantity: row.qty, companyId },
    transaction: t,
  });
  if (Number(stock.quantity) !== row.qty) await stock.update({ quantity: row.qty }, { transaction: t });
}

module.exports = { upsertSkuWarehouseStock, moveSkuWarehouseStock, syncLegacyStock };
