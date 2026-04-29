'use strict';
process.env.NODE_ENV = 'test';

const request = require('supertest');
const app     = require('../app');
const { initDb } = require('./setup');
const {
  Product, ProductSKU, Stock,
  Stock_Opname_Session, Stock_Opname_Item,
} = require('../models');

let state;
let product, sku, sessionId, sessionId2;

beforeAll(async () => {
  state = await initDb();

  product = await Product.create({
    name: 'Opname Test Product',
    CategoryId: state.category.id,
    unit: 'pcs',
    companyId: state.company.id,
  });

  sku = await ProductSKU.create({
    ProductId: product.id,
    sku_code: 'OPN-SKU-001',
    price: 12000,
    qty: 0,
    companyId: state.company.id,
  });

  // Seed stock so opname items can find system_qty
  await Stock.create({
    ProductId: product.id,
    WarehouseId: state.warehouse.id,
    quantity: 50,
    companyId: state.company.id,
  });
});

afterAll(async () => {
  await Stock_Opname_Item.destroy({ where: {} }).catch(() => {});
  await Stock_Opname_Session.destroy({ where: { companyId: state.company.id } }).catch(() => {});
  await Stock.destroy({ where: { ProductId: product.id } }).catch(() => {});
  await ProductSKU.destroy({ where: { id: sku.id } }).catch(() => {});
  await Product.destroy({ where: { id: product.id } }).catch(() => {});
});

const auth = () => ({ Authorization: `Bearer ${state.tokens.admin}` });

describe('Stock Opname Sessions', () => {
  test('POST /stock-opname-sessions — creates open session', async () => {
    const res = await request(app)
      .post('/stock-opname-sessions')
      .set(auth())
      .send({ WarehouseId: state.warehouse.id, notes: 'Opname bulanan' });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('open');
    expect(res.body.warehouseId).toBe(state.warehouse.id);
    sessionId = res.body.id;
  });

  test('POST /stock-opname-sessions — returns 400 without WarehouseId', async () => {
    const res = await request(app)
      .post('/stock-opname-sessions')
      .set(auth())
      .send({ notes: 'No warehouse' });
    expect(res.status).toBe(400);
  });

  test('GET /stock-opname-sessions — returns paginated list', async () => {
    const res = await request(app).get('/stock-opname-sessions').set(auth());
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
  });

  test('GET /stock-opname-sessions — filters by status=open', async () => {
    const res = await request(app)
      .get('/stock-opname-sessions?status=open')
      .set(auth());
    expect(res.status).toBe(200);
    res.body.data.forEach(s => expect(s.status).toBe('open'));
  });

  test('GET /stock-opname-sessions/:id — returns session with Warehouse', async () => {
    const res = await request(app)
      .get(`/stock-opname-sessions/${sessionId}`)
      .set(auth());
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('Warehouse');
  });
});

describe('Stock Opname Items', () => {
  let itemId;

  test('POST /stock-opname-items — creates item, auto-fills system_qty', async () => {
    const res = await request(app)
      .post('/stock-opname-items')
      .set(auth())
      .send({
        StockOpnameSessionId: sessionId,
        ProductId: product.id,
        actualQty: 45,
      });

    expect(res.status).toBe(201);
    expect(res.body.scanned_qty).toBe(45);
    expect(res.body.system_qty).toBe(50);           // auto-resolved from Stock
    expect(res.body.difference).toBe(-5);           // 45 - 50
    itemId = res.body.id;
  });

  test('GET /stock-opname-items — filters by SessionId', async () => {
    const res = await request(app)
      .get(`/stock-opname-items?SessionId=${sessionId}`)
      .set(auth());
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].id).toBe(itemId);
  });

  test('PUT /stock-opname-items/:id — updates scanned_qty and difference', async () => {
    const res = await request(app)
      .put(`/stock-opname-items/${itemId}`)
      .set(auth())
      .send({ scanned_qty: 48, difference: -2 });

    expect(res.status).toBe(200);
    expect(res.body.scanned_qty).toBe(48);
  });

  test('DELETE /stock-opname-items/:id — removes item', async () => {
    const res = await request(app)
      .delete(`/stock-opname-items/${itemId}`)
      .set(auth());
    expect(res.status).toBe(200);
    itemId = null;
  });

  test('POST — returns 400 for missing required fields', async () => {
    const res = await request(app)
      .post('/stock-opname-items')
      .set(auth())
      .send({ StockOpnameSessionId: sessionId });    // no ProductId or actualQty
    expect(res.status).toBe(400);
  });
});

describe('Close session — adjusts stock', () => {
  let closeSessionId;
  let itemBeforeClose;

  beforeAll(async () => {
    // Create a fresh session for close flow
    const s = await Stock_Opname_Session.create({
      warehouseId: state.warehouse.id,
      companyId: state.company.id,
      createdBy: state.admin.id,
      status: 'open',
      started_at: new Date(),
    });
    closeSessionId = s.id;

    // Add one item: actual=40 vs system=50 → diff=-10
    await request(app)
      .post('/stock-opname-items')
      .set(auth())
      .send({ StockOpnameSessionId: closeSessionId, ProductId: product.id, actualQty: 40 });

    const stockBefore = await Stock.findOne({
      where: { ProductId: product.id, WarehouseId: state.warehouse.id },
    });
    itemBeforeClose = stockBefore.quantity;
  });

  test('PUT status:closed — adjusts stock by difference', async () => {
    const res = await request(app)
      .put(`/stock-opname-sessions/${closeSessionId}`)
      .set(auth())
      .send({ status: 'closed' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('closed');
    expect(res.body.finished_at).not.toBeNull();

    // Stock should decrease by 10 (actual 40 vs system 50)
    const stockAfter = await Stock.findOne({
      where: { ProductId: product.id, WarehouseId: state.warehouse.id },
    });
    expect(stockAfter.quantity).toBe(Math.max(0, itemBeforeClose - 10));
  });

  test('Closed session shows status=closed in list', async () => {
    const res = await request(app)
      .get('/stock-opname-sessions?status=closed')
      .set(auth());
    expect(res.status).toBe(200);
    const found = res.body.data.find(s => s.id === closeSessionId);
    expect(found).toBeDefined();
    expect(found.status).toBe('closed');
  });
});

describe('Cancel session', () => {
  test('PUT status:cancelled — does NOT adjust stock', async () => {
    const stockBefore = await Stock.findOne({
      where: { ProductId: product.id, WarehouseId: state.warehouse.id },
    });
    const qtyBefore = stockBefore.quantity;

    // Add item then cancel
    await request(app)
      .post('/stock-opname-items')
      .set(auth())
      .send({ StockOpnameSessionId: sessionId, ProductId: product.id, actualQty: 1 });

    const res = await request(app)
      .put(`/stock-opname-sessions/${sessionId}`)
      .set(auth())
      .send({ status: 'cancelled' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('cancelled');

    // Stock must remain unchanged
    const stockAfter = await Stock.findOne({
      where: { ProductId: product.id, WarehouseId: state.warehouse.id },
    });
    expect(stockAfter.quantity).toBe(qtyBefore);
  });
});
