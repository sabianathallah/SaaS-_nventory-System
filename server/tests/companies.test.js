'use strict';
process.env.NODE_ENV = 'test';

const request = require('supertest');
const app     = require('../app');
const { initDb }   = require('./setup');
const { Company }  = require('../models');

let state;
let createdId;

beforeAll(async () => { state = await initDb(); });

afterAll(async () => {
  if (createdId) await Company.destroy({ where: { id: createdId } }).catch(() => {});
});

const auth = () => ({ Authorization: `Bearer ${state.tokens.superAdmin}` });
const adminAuth = () => ({ Authorization: `Bearer ${state.tokens.admin}` });

describe('GET /companies', () => {
  test('SUPER_ADMIN can list companies', async () => {
    const res = await request(app).get('/companies').set(auth());
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('pagination');
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  test('non-admin (OPERASIONAL) gets 403', async () => {
    const res = await request(app)
      .get('/companies')
      .set({ Authorization: `Bearer ${state.tokens.ops}` });
    expect(res.status).toBe(403);
  });
});

describe('POST /companies', () => {
  test('creates a new company', async () => {
    const res = await request(app)
      .post('/companies')
      .set(auth())
      .send({ name: 'New Corp', slug: 'new-corp', status: 'active' });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe('New Corp');
    expect(res.body.slug).toBe('new-corp');
    createdId = res.body.id;
  });

  test('returns 400 when name is missing', async () => {
    const res = await request(app)
      .post('/companies')
      .set(auth())
      .send({ slug: 'no-name' });
    expect(res.status).toBe(400);
  });

  test('returns 409 for duplicate slug', async () => {
    const res = await request(app)
      .post('/companies')
      .set(auth())
      .send({ name: 'Duplicate', slug: 'new-corp', status: 'active' });
    expect(res.status).toBe(409);
  });
});

describe('GET /companies/:id', () => {
  test('returns the company by id', async () => {
    const res = await request(app)
      .get(`/companies/${createdId}`)
      .set(auth());
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(createdId);
  });

  test('returns 404 for non-existent id', async () => {
    const res = await request(app)
      .get('/companies/99999')
      .set(auth());
    expect(res.status).toBe(404);
  });
});

describe('PUT /companies/:id', () => {
  test('updates company status', async () => {
    const res = await request(app)
      .put(`/companies/${createdId}`)
      .set(auth())
      .send({ name: 'New Corp Updated', slug: 'new-corp', status: 'inactive' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('inactive');
  });
});

describe('DELETE /companies/:id', () => {
  test('deletes the company', async () => {
    const res = await request(app)
      .delete(`/companies/${createdId}`)
      .set(auth());
    expect(res.status).toBe(200);
    createdId = null;
  });
});
