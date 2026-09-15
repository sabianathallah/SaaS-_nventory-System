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
}

/**
 * Move qty from one warehouse to another (for stock transfers).
 */
async function moveSkuWarehouseStock(t, SkuWarehouseStock, { ProductSKUId, fromWarehouseId, toWarehouseId, qty, companyId }) {
  await upsertSkuWarehouseStock(t, SkuWarehouseStock, { ProductSKUId, WarehouseId: fromWarehouseId, delta: -qty, companyId });
  await upsertSkuWarehouseStock(t, SkuWarehouseStock, { ProductSKUId, WarehouseId: toWarehouseId,   delta:  qty, companyId });
}

module.exports = { upsertSkuWarehouseStock, moveSkuWarehouseStock };
