'use strict';
process.env.NODE_ENV = 'test';

const request   = require('supertest');
const app       = require('../app');
const { initDb }    = require('./setup');
const { Warehouse } = require('../models');

let state;
let warehouseId;

beforeAll(async () => { state = await initDb(); });

afterAll(async () => {
  if (warehouseId) await Warehouse.destroy({ where: { id: warehouseId } }).catch(() => {});
});

const auth = () => ({ Authorization: `Bearer ${state.tokens.admin}` });

describe('GET /warehouses', () => {
  test('returns paginated list', async () => {
    const res = await request(app).get('/warehouses').set(auth());
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('pagination');
  });

  test('supports name search', async () => {
    const res = await request(app)
      .get('/warehouses?name=Test')
      .set(auth());
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
  });
});

describe('POST /warehouses', () => {
  test('creates a warehouse', async () => {
    const res = await request(app)
      .post('/warehouses')
      .set(auth())
      .send({ name: 'Gudang Baru', location: 'Bandung' });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Gudang Baru');
    warehouseId = res.body.id;
  });

  test('returns 400 when name is missing', async () => {
    const res = await request(app)
      .post('/warehouses')
      .set(auth())
      .send({ location: 'Surabaya' });
    expect(res.status).toBe(400);
  });

  test('returns 400 when location is missing', async () => {
    const res = await request(app)
      .post('/warehouses')
      .set(auth())
      .send({ name: 'Gudang Tanpa Lokasi' });
    expect(res.status).toBe(400);
  });
});

describe('GET /warehouses/:id', () => {
  test('returns the warehouse', async () => {
    const res = await request(app)
      .get(`/warehouses/${warehouseId}`)
      .set(auth());
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(warehouseId);
  });

  test('returns 404 for non-existent id', async () => {
    const res = await request(app)
      .get('/warehouses/99999')
      .set(auth());
    expect(res.status).toBe(404);
  });
});

describe('PUT /warehouses/:id', () => {
  test('updates warehouse name and location', async () => {
    const res = await request(app)
      .put(`/warehouses/${warehouseId}`)
      .set(auth())
      .send({ name: 'Gudang Diperbarui', location: 'Yogyakarta' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Gudang Diperbarui');
  });
});

describe('DELETE /warehouses/:id', () => {
  test('deletes the warehouse', async () => {
    const res = await request(app)
      .delete(`/warehouses/${warehouseId}`)
      .set(auth());
    expect(res.status).toBe(200);
    warehouseId = null;
  });
});
