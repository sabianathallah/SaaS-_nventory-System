'use strict';
process.env.NODE_ENV = 'test';

const request   = require('supertest');
const app       = require('../app');
const { initDb }    = require('./setup');
const { Product, ProductSKU } = require('../models');

let state;
let productId;
let skuId;

beforeAll(async () => { state = await initDb(); });

afterAll(async () => {
  if (skuId)     await ProductSKU.destroy({ where: { id: skuId } }).catch(() => {});
  if (productId) await Product.destroy({ where: { id: productId } }).catch(() => {});
});

const auth = () => ({ Authorization: `Bearer ${state.tokens.admin}` });

describe('Products CRUD', () => {
  test('POST /products — creates product without image', async () => {
    const res = await request(app)
      .post('/products')
      .set(auth())
      .send({
        name: 'Produk Test',
        CategoryId: state.category.id,
        unit: 'pcs',
        price: 10000,
        companyId: state.company.id,
      });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Produk Test');
    productId = res.body.id;
  });

  test('POST /products — returns 400 when name is missing', async () => {
    const res = await request(app)
      .post('/products')
      .set(auth())
      .send({ CategoryId: state.category.id, unit: 'pcs' });
    expect(res.status).toBe(400);
  });

  test('POST /products — returns 400 when CategoryId is missing', async () => {
    const res = await request(app)
      .post('/products')
      .set(auth())
      .send({ name: 'No Category', unit: 'pcs' });
    expect(res.status).toBe(400);
  });

  test('GET /products — returns paginated list', async () => {
    const res = await request(app).get('/products').set(auth());
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.pagination.total).toBeGreaterThanOrEqual(1);
  });

  test('GET /products — supports name search', async () => {
    const res = await request(app)
      .get('/products?name=Produk Test')
      .set(auth());
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
  });

  test('GET /products/:id — returns product detail', async () => {
    const res = await request(app)
      .get(`/products/${productId}`)
      .set(auth());
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(productId);
    expect(res.body).toHaveProperty('Category');
  });

  test('PUT /products/:id — updates product fields', async () => {
    const res = await request(app)
      .put(`/products/${productId}`)
      .set(auth())
      .send({
        name: 'Produk Test Updated',
        CategoryId: state.category.id,
        unit: 'box',
        price: 15000,
      });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Produk Test Updated');
    expect(res.body.unit).toBe('box');
  });

  test('GET /products/:id — returns 404 for unknown id', async () => {
    const res = await request(app)
      .get('/products/99999')
      .set(auth());
    expect(res.status).toBe(404);
  });
});

describe('Product SKUs', () => {
  test('POST /products/:id/skus — creates a SKU', async () => {
    const res = await request(app)
      .post(`/products/${productId}/skus`)
      .set(auth())
      .send({ sku_code: 'SKU-TEST-001', price: 10000, qty: 0 });

    expect(res.status).toBe(201);
    expect(res.body.sku_code).toBe('SKU-TEST-001');
    skuId = res.body.id;
  });

  test('GET /products/:id/skus — lists SKUs', async () => {
    const res = await request(app)
      .get(`/products/${productId}/skus`)
      .set(auth());
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(1);
  });

  test('DELETE /products/:id/skus/:skuId — deletes SKU', async () => {
    const res = await request(app)
      .delete(`/products/${productId}/skus/${skuId}`)
      .set(auth());
    expect(res.status).toBe(200);
    skuId = null;
  });
});

describe('DELETE /products/:id', () => {
  test('deletes the product', async () => {
    const res = await request(app)
      .delete(`/products/${productId}`)
      .set(auth());
    expect(res.status).toBe(200);
    productId = null;
  });
});
