'use strict';
process.env.NODE_ENV = 'test';

const request    = require('supertest');
const app        = require('../app');
const { initDb }     = require('./setup');
const { Supplier }   = require('../models');

let state;
let supplierId;

beforeAll(async () => { state = await initDb(); });

afterAll(async () => {
  if (supplierId) await Supplier.destroy({ where: { id: supplierId } }).catch(() => {});
});

const auth = () => ({ Authorization: `Bearer ${state.tokens.admin}` });

describe('Suppliers CRUD', () => {
  test('POST /suppliers — creates supplier', async () => {
    const res = await request(app)
      .post('/suppliers')
      .set(auth())
      .send({ name: 'PT Sumber Jaya', contact: '021-1234567' });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe('PT Sumber Jaya');
    supplierId = res.body.id;
  });

  test('POST /suppliers — returns 400 when name is missing', async () => {
    const res = await request(app)
      .post('/suppliers')
      .set(auth())
      .send({ contact: '021-999' });
    expect(res.status).toBe(400);
  });

  test('GET /suppliers — returns paginated list', async () => {
    const res = await request(app).get('/suppliers').set(auth());
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
  });

  test('GET /suppliers — supports name search', async () => {
    const res = await request(app)
      .get('/suppliers?name=Sumber')
      .set(auth());
    expect(res.status).toBe(200);
    expect(res.body.data[0].name).toContain('Sumber');
  });

  test('GET /suppliers/:id — returns supplier', async () => {
    const res = await request(app)
      .get(`/suppliers/${supplierId}`)
      .set(auth());
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(supplierId);
  });

  test('PUT /suppliers/:id — updates contact', async () => {
    const res = await request(app)
      .put(`/suppliers/${supplierId}`)
      .set(auth())
      .send({ name: 'PT Sumber Jaya', contact: '022-9999' });
    expect(res.status).toBe(200);
    expect(res.body.contact).toBe('022-9999');
  });

  test('DELETE /suppliers/:id — deletes supplier', async () => {
    const res = await request(app)
      .delete(`/suppliers/${supplierId}`)
      .set(auth());
    expect(res.status).toBe(200);
    supplierId = null;
  });

  test('GET /suppliers/:id — 404 after deletion', async () => {
    const res = await request(app)
      .get('/suppliers/99999')
      .set(auth());
    expect(res.status).toBe(404);
  });
});
