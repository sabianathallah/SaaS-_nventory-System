'use strict';
process.env.NODE_ENV = 'test';

const request    = require('supertest');
const app        = require('../app');
const { initDb }     = require('./setup');
const { Category }   = require('../models');

let state;
let catId;

beforeAll(async () => { state = await initDb(); });

afterAll(async () => {
  if (catId) await Category.destroy({ where: { id: catId } }).catch(() => {});
});

const auth = () => ({ Authorization: `Bearer ${state.tokens.admin}` });

describe('Categories CRUD', () => {
  test('POST /categories — creates category', async () => {
    const res = await request(app)
      .post('/categories')
      .set(auth())
      .send({ name: 'Elektronik' });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Elektronik');
    catId = res.body.id;
  });

  test('POST /categories — returns 400 for missing name', async () => {
    const res = await request(app)
      .post('/categories')
      .set(auth())
      .send({});
    expect(res.status).toBe(400);
  });

  test('GET /categories — returns list with pagination', async () => {
    const res = await request(app).get('/categories').set(auth());
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.pagination.total).toBeGreaterThanOrEqual(1);
  });

  test('GET /categories/:id — returns category', async () => {
    const res = await request(app)
      .get(`/categories/${catId}`)
      .set(auth());
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(catId);
  });

  test('PUT /categories/:id — updates name', async () => {
    const res = await request(app)
      .put(`/categories/${catId}`)
      .set(auth())
      .send({ name: 'Elektronik & Gadget' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Elektronik & Gadget');
  });

  test('DELETE /categories/:id — deletes category', async () => {
    const res = await request(app)
      .delete(`/categories/${catId}`)
      .set(auth());
    expect(res.status).toBe(200);
    catId = null;
  });
});
