'use strict';
process.env.NODE_ENV = 'test';

const request = require('supertest');
const app     = require('../app');
const { initDb } = require('./setup');
const { Product, ProductSKU, Stock_Movement, Stock_In_Header, Stock } = require('../models');

let state;
let product, sku;

beforeAll(async () => {
  state = await initDb();

  product = await Product.create({
    name: 'Movement Test Product',
    CategoryId: state.category.id,
    unit: 'pcs',
    companyId: state.company.id,
  });

  sku = await ProductSKU.create({
    ProductId: product.id,
    sku_code: 'MOV-SKU-001',
    price: 8000,
    qty: 0,
    companyId: state.company.id,
  });

  // Seed a stock-in (creates IN movement)
  const header = await Stock_In_Header.create({
    WarehouseId: state.warehouse.id,
    date: new Date(),
    companyId: state.company.id,
  });

  await Stock.findOrCreate({
    where: { ProductId: product.id, WarehouseId: state.warehouse.id },
    defaults: { quantity: 20, companyId: state.company.id },
  });

  // Manually create movements for predictable test data
  await Stock_Movement.bulkCreate([
    { ProductId: product.id, WarehouseId: state.warehouse.id, type: 'IN',         quantity: 20, ReferenceId: header.id, companyId: state.company.id },
    { ProductId: product.id, WarehouseId: state.warehouse.id, type: 'OUT',        quantity: 5,  ReferenceId: header.id, companyId: state.company.id },
    { ProductId: product.id, WarehouseId: state.warehouse.id, type: 'ADJUSTMENT', quantity: 2,  ReferenceId: header.id, companyId: state.company.id },
  ]);
});

afterAll(async () => {
  await Stock_Movement.destroy({ where: { ProductId: product.id } }).catch(() => {});
  await Stock.destroy({ where: { ProductId: product.id } }).catch(() => {});
  await Stock_In_Header.destroy({ where: { companyId: state.company.id } }).catch(() => {});
  await ProductSKU.destroy({ where: { id: sku.id } }).catch(() => {});
  await Product.destroy({ where: { id: product.id } }).catch(() => {});
});

const auth = () => ({ Authorization: `Bearer ${state.tokens.admin}` });

describe('GET /stock-movements', () => {
  test('returns paginated movement list', async () => {
    const res = await request(app).get('/stock-movements').set(auth());
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('pagination');
    expect(res.body.data.length).toBeGreaterThanOrEqual(3);
  });

  test('filters by type=IN', async () => {
    const res = await request(app)
      .get('/stock-movements?type=IN')
      .set(auth());
    expect(res.status).toBe(200);
    res.body.data.forEach(m => expect(m.type).toBe('IN'));
  });

  test('filters by type=OUT', async () => {
    const res = await request(app)
      .get('/stock-movements?type=OUT')
      .set(auth());
    expect(res.status).toBe(200);
    res.body.data.forEach(m => expect(m.type).toBe('OUT'));
  });

  test('filters by ProductId', async () => {
    const res = await request(app)
      .get(`/stock-movements?ProductId=${product.id}`)
      .set(auth());
    expect(res.status).toBe(200);
    res.body.data.forEach(m => expect(m.ProductId).toBe(product.id));
  });

  test('filters by dateFrom and dateTo', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const res = await request(app)
      .get(`/stock-movements?dateFrom=${today}&dateTo=${today}`)
      .set(auth());
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  test('includes Product and Warehouse associations', async () => {
    const res = await request(app)
      .get(`/stock-movements?ProductId=${product.id}&limit=1`)
      .set(auth());
    expect(res.status).toBe(200);
    const row = res.body.data[0];
    expect(row).toHaveProperty('Product');
    expect(row).toHaveProperty('Warehouse');
    expect(row.Product.name).toBe('Movement Test Product');
  });
});

describe('GET /stock-movements/summary', () => {
  test('returns totalIn, totalOut, totalAdj, net', async () => {
    const res = await request(app)
      .get(`/stock-movements/summary?ProductId=${product.id}`)
      .set(auth());

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('totalIn');
    expect(res.body).toHaveProperty('totalOut');
    expect(res.body).toHaveProperty('totalAdj');
    expect(res.body).toHaveProperty('net');
  });

  test('totalIn >= OUT + ADJ from our seeded movements', async () => {
    const res = await request(app)
      .get(`/stock-movements/summary?ProductId=${product.id}`)
      .set(auth());

    expect(res.body.totalIn).toBeGreaterThanOrEqual(20);
    expect(res.body.totalOut).toBeGreaterThanOrEqual(5);
    expect(res.body.totalAdj).toBeGreaterThanOrEqual(2);
    // net = IN - OUT (ADJUSTMENT not subtracted)
    expect(res.body.net).toBe(res.body.totalIn - res.body.totalOut);
  });

  test('summary always returns shape with four numeric fields', async () => {
    // Note: the /summary endpoint applies type filter to date/warehouse/product
    // but each individual sum (totalIn, totalOut, totalAdj) always overrides
    // the type field, so all three are always populated regardless of ?type=
    const res = await request(app)
      .get(`/stock-movements/summary?type=IN&ProductId=${product.id}`)
      .set(auth());
    expect(res.status).toBe(200);
    expect(typeof res.body.totalIn).toBe('number');
    expect(typeof res.body.totalOut).toBe('number');
    expect(typeof res.body.totalAdj).toBe('number');
    expect(typeof res.body.net).toBe('number');
  });
});

describe('GET /stock-movements/chart', () => {
  test('returns array of daily pivots', async () => {
    const res = await request(app)
      .get(`/stock-movements/chart?ProductId=${product.id}`)
      .set(auth());

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);

    if (res.body.length > 0) {
      const row = res.body[0];
      expect(row).toHaveProperty('date');
      expect(row).toHaveProperty('IN');
      expect(row).toHaveProperty('OUT');
      expect(row).toHaveProperty('ADJUSTMENT');
    }
  });

  test('chart values match seeded data', async () => {
    // Query without date filter to avoid timezone-dependent date comparison
    const res = await request(app)
      .get(`/stock-movements/chart?ProductId=${product.id}`)
      .set(auth());

    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(1);

    // Aggregate totals across all rows
    const totalIN  = res.body.reduce((s, r) => s + r.IN,  0);
    const totalOUT = res.body.reduce((s, r) => s + r.OUT, 0);
    expect(totalIN).toBeGreaterThanOrEqual(20);
    expect(totalOUT).toBeGreaterThanOrEqual(5);
  });
});

describe('GET /stock-movements/export/csv', () => {
  test('returns CSV with correct Content-Type', async () => {
    const res = await request(app)
      .get('/stock-movements/export/csv')
      .set(auth());

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    expect(res.headers['content-disposition']).toContain('movements.csv');
  });

  test('CSV body starts with header row', async () => {
    const res = await request(app)
      .get('/stock-movements/export/csv')
      .set(auth());

    const firstLine = res.text.split('\n')[0];
    expect(firstLine).toContain('Date');
    expect(firstLine).toContain('Type');
    expect(firstLine).toContain('Product');
    expect(firstLine).toContain('Quantity');
  });

  test('CSV filters by ProductId', async () => {
    const res = await request(app)
      .get(`/stock-movements/export/csv?ProductId=${product.id}`)
      .set(auth());

    expect(res.status).toBe(200);
    const lines = res.text.trim().split('\n');
    // header + at least 3 data rows
    expect(lines.length).toBeGreaterThanOrEqual(4);
  });
});

describe('GET /stock-movements/:id', () => {
  let movementId;

  beforeAll(async () => {
    const res = await request(app)
      .get(`/stock-movements?ProductId=${product.id}&limit=1`)
      .set(auth());
    movementId = res.body.data[0]?.id;
  });

  test('returns single movement by id', async () => {
    if (!movementId) return;
    const res = await request(app)
      .get(`/stock-movements/${movementId}`)
      .set(auth());
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(movementId);
  });

  test('returns 404 for non-existent id', async () => {
    const res = await request(app)
      .get('/stock-movements/99999')
      .set(auth());
    expect(res.status).toBe(404);
  });
});
