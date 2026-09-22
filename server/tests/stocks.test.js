'use strict';
process.env.NODE_ENV = 'test';

const request = require('supertest');
const app     = require('../app');
const { initDb } = require('./setup');
const { Product, ProductSKU, Stock, Stock_In_Header, Stock_Out_Header } = require('../models');

let state;
let product, sku, stockInId;

beforeAll(async () => {
  state = await initDb();

  // Create a product + SKU to use in stock-in tests
  product = await Product.create({
    name: 'Stock Test Product',
    CategoryId: state.category.id,
    unit: 'pcs',
    companyId: state.company.id,
  });

  sku = await ProductSKU.create({
    ProductId: product.id,
    sku_code: 'STOCK-SKU-001',
    price: 5000,
    qty: 0,
    companyId: state.company.id,
  });
});

afterAll(async () => {
  await Stock.destroy({ where: { ProductId: product.id } }).catch(() => {});
  await Stock_Out_Header.destroy({ where: { companyId: state.company.id } }).catch(() => {});
  await Stock_In_Header.destroy({ where: { companyId: state.company.id } }).catch(() => {});
  await ProductSKU.destroy({ where: { id: sku.id } }).catch(() => {});
  await Product.destroy({ where: { id: product.id } }).catch(() => {});
});

const auth = () => ({ Authorization: `Bearer ${state.tokens.admin}` });

describe('Stock In', () => {
  test('POST /stock-in-headers — creates header without items (valid)', async () => {
    const res = await request(app)
      .post('/stock-in-headers')
      .set(auth())
      .send({
        WarehouseId: state.warehouse.id,
        note: 'Test stock in',
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    stockInId = res.body.id;
  });

  test('POST /stock-in-headers — creates stock movement when item is added', async () => {
    // Headers are created 'closed' by default — must be reopened before
    // items can be added one at a time via this endpoint.
    const openRes = await request(app)
      .patch(`/stock-in-headers/${stockInId}/status`)
      .set(auth())
      .send({ status: 'open' });
    expect(openRes.status).toBe(200);

    const res = await request(app)
      .post(`/stock-in-headers/${stockInId}/items`)
      .set(auth())
      .send({ ProductSKUId: sku.id, quantity: 10, price: 5000 });

    expect(res.status).toBe(201);
  });

  test('POST /stock-in-headers — returns 400 without WarehouseId', async () => {
    const res = await request(app)
      .post('/stock-in-headers')
      .set(auth())
      .send({ note: 'No warehouse' });
    expect(res.status).toBe(400);
  });

  test('GET /stock-in-headers — lists headers with pagination', async () => {
    const res = await request(app).get('/stock-in-headers').set(auth());
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
  });

  test('GET /stock-in-headers/:id — returns header with items', async () => {
    const res = await request(app)
      .get(`/stock-in-headers/${stockInId}`)
      .set(auth());
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('Stock_In_Items');
  });
});

describe('Stock levels after Stock In', () => {
  test('GET /stocks — product has quantity 10 after stock in', async () => {
    const res = await request(app)
      .get(`/stocks?ProductId=${product.id}&WarehouseId=${state.warehouse.id}`)
      .set(auth());
    expect(res.status).toBe(200);
    const stockRow = res.body.data.find(s => s.ProductId === product.id);
    expect(stockRow).toBeDefined();
    expect(stockRow.quantity).toBe(10);
  });
});

describe('Stock Out', () => {
  test('POST /stock-out-headers — creates OUT transaction and decrements stock', async () => {
    const res = await request(app)
      .post('/stock-out-headers')
      .set(auth())
      .send({
        WarehouseId: state.warehouse.id,
        purpose: 'Lainnya',
        note: 'Test stock out',
        items: [{ ProductId: product.id, quantity: 3 }],
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('movements');
    expect(res.body.movements.length).toBe(1);
  });

  test('POST /stock-out-headers — returns 400 when items is empty', async () => {
    const res = await request(app)
      .post('/stock-out-headers')
      .set(auth())
      .send({
        WarehouseId: state.warehouse.id,
        purpose: 'Lainnya',
        items: [],
      });
    expect(res.status).toBe(400);
  });

  test('POST /stock-out-headers — returns 400 when purpose is missing', async () => {
    const res = await request(app)
      .post('/stock-out-headers')
      .set(auth())
      .send({
        WarehouseId: state.warehouse.id,
        items: [{ ProductId: product.id, quantity: 1 }],
      });
    expect(res.status).toBe(400);
  });

  test('Stock quantity is 7 after out of 3', async () => {
    const res = await request(app)
      .get(`/stocks?ProductId=${product.id}&WarehouseId=${state.warehouse.id}`)
      .set(auth());
    const stockRow = res.body.data.find(s => s.ProductId === product.id);
    expect(stockRow.quantity).toBe(7);
  });
});

describe('resolve-sku endpoint', () => {
  test('GET /stock-in-headers/resolve-sku — resolves valid SKU code', async () => {
    const res = await request(app)
      .get(`/stock-in-headers/resolve-sku?code=${sku.sku_code}`)
      .set(auth());
    expect(res.status).toBe(200);
    expect(res.body.sku_code).toBe(sku.sku_code);
  });

  test('GET /stock-in-headers/resolve-sku — returns 404 for unknown code', async () => {
    const res = await request(app)
      .get('/stock-in-headers/resolve-sku?code=NOT-EXIST-999')
      .set(auth());
    expect(res.status).toBe(404);
  });
});
