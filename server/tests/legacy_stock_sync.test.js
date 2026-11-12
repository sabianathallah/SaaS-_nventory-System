'use strict';
process.env.NODE_ENV = 'test';

const { initDb } = require('./setup');
const { sequelize, Product, ProductSKU, Stock, SkuWarehouseStock, Warehouse } = require('../models');
const { upsertSkuWarehouseStock, moveSkuWarehouseStock } = require('../helpers/skuStock');

let state, product, skuA, skuB, whA, whB;

beforeAll(async () => {
  state = await initDb();
  const cid = state.company.id;
  product = await Product.create({ name: 'Legacy Sync Product', CategoryId: state.category.id, unit: 'pcs', companyId: cid });
  skuA = await ProductSKU.create({ ProductId: product.id, sku_code: 'LSYNC-A', price: 1000, qty: 0, companyId: cid });
  skuB = await ProductSKU.create({ ProductId: product.id, sku_code: 'LSYNC-B', price: 1000, qty: 0, companyId: cid });
  whA = await Warehouse.create({ name: 'LSYNC Booth', location: 'Test', companyId: cid });
  whB = await Warehouse.create({ name: 'LSYNC Ready', location: 'Test', companyId: cid });
});

const legacyQty = async (WarehouseId) =>
  Number((await Stock.findOne({ where: { ProductId: product.id, WarehouseId } }))?.quantity ?? 0);

const run = (fn) => sequelize.transaction(fn);

describe('legacy Stocks stays derived from SkuWarehouseStocks', () => {
  it('follows a warehouse into minus and back without phantom stock', async () => {
    const cid = state.company.id;
    await run(t => upsertSkuWarehouseStock(t, SkuWarehouseStock, { ProductSKUId: skuA.id, WarehouseId: whA.id, delta: 3, companyId: cid }));
    expect(await legacyQty(whA.id)).toBe(3);

    // sold more than available (POS booth may go minus)
    await run(t => upsertSkuWarehouseStock(t, SkuWarehouseStock, { ProductSKUId: skuA.id, WarehouseId: whA.id, delta: -10, companyId: cid }));
    expect(await legacyQty(whA.id)).toBe(-7);

    // correction stock-in brings it back to 0 — must not leave phantom stock
    await run(t => upsertSkuWarehouseStock(t, SkuWarehouseStock, { ProductSKUId: skuA.id, WarehouseId: whA.id, delta: 7, companyId: cid }));
    expect(await legacyQty(whA.id)).toBe(0);
  });

  it('sums every SKU of the product and moves with transfers', async () => {
    const cid = state.company.id;
    await run(async t => {
      await upsertSkuWarehouseStock(t, SkuWarehouseStock, { ProductSKUId: skuA.id, WarehouseId: whA.id, delta: 4, companyId: cid });
      await upsertSkuWarehouseStock(t, SkuWarehouseStock, { ProductSKUId: skuB.id, WarehouseId: whA.id, delta: 6, companyId: cid });
    });
    expect(await legacyQty(whA.id)).toBe(10);

    await run(t => moveSkuWarehouseStock(t, SkuWarehouseStock, { ProductSKUId: skuB.id, fromWarehouseId: whA.id, toWarehouseId: whB.id, qty: 6, companyId: cid }));
    expect(await legacyQty(whA.id)).toBe(4);
    expect(await legacyQty(whB.id)).toBe(6);
  });
});
