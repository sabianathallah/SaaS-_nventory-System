'use strict';
process.env.NODE_ENV = 'test';

const request = require('supertest');
const app     = require('../app');
const { initDb } = require('./setup');
const { User }   = require('../models');

let state;
let createdUserId;

beforeAll(async () => { state = await initDb(); });

afterAll(async () => {
  if (createdUserId) await User.destroy({ where: { id: createdUserId } }).catch(() => {});
});

const auth      = () => ({ Authorization: `Bearer ${state.tokens.admin}` });
const superAuth = () => ({ Authorization: `Bearer ${state.tokens.superAdmin}` });
const opsAuth   = () => ({ Authorization: `Bearer ${state.tokens.ops}` });

describe('GET /users', () => {
  test('admin can list users', async () => {
    const res = await request(app).get('/users').set(auth());
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
  });

  test('OPERASIONAL cannot list users (403)', async () => {
    const res = await request(app).get('/users').set(opsAuth());
    expect(res.status).toBe(403);
  });

  test('supports name search', async () => {
    const res = await request(app)
      .get('/users?name=Company Admin')
      .set(auth());
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
  });
});

describe('POST /users', () => {
  test('creates a new user', async () => {
    const res = await request(app)
      .post('/users')
      .set(auth())
      .send({
        name:      'Budi Santoso',
        email:     'budi@test.com',
        password:  'secret123',
        role:      'OPERASIONAL',
        companyId: state.company.id,
      });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Budi Santoso');
    expect(res.body).not.toHaveProperty('password');  // password not returned
    createdUserId = res.body.id;
  });

  test('returns 409 for duplicate email', async () => {
    const res = await request(app)
      .post('/users')
      .set(auth())
      .send({
        name:     'Duplicate Budi',
        email:    'budi@test.com',
        password: 'abc123',
        role:     'HR',
      });
    expect(res.status).toBe(409);
  });

  test('returns 400 when email is missing', async () => {
    const res = await request(app)
      .post('/users')
      .set(auth())
      .send({ name: 'No Email', password: 'pass123', role: 'HR' });
    expect(res.status).toBe(400);
  });
});

describe('GET /users/:id', () => {
  test('returns user by id', async () => {
    const res = await request(app)
      .get(`/users/${createdUserId}`)
      .set(auth());
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(createdUserId);
  });

  test('returns 404 for unknown id', async () => {
    const res = await request(app)
      .get('/users/99999')
      .set(auth());
    expect(res.status).toBe(404);
  });
});

describe('PUT /users/:id', () => {
  test('updates user name', async () => {
    const res = await request(app)
      .put(`/users/${createdUserId}`)
      .set(auth())
      .send({ name: 'Budi Updated', email: 'budi@test.com', role: 'OPERASIONAL' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Budi Updated');
  });

  test('updates password (new password should be hashed)', async () => {
    const res = await request(app)
      .put(`/users/${createdUserId}`)
      .set(auth())
      .send({ name: 'Budi Updated', email: 'budi@test.com', role: 'OPERASIONAL', password: 'newpass456' });
    expect(res.status).toBe(200);
    // Verify new password works
    const loginRes = await request(app)
      .post('/login')
      .send({ email: 'budi@test.com', password: 'newpass456' });
    expect(loginRes.status).toBe(200);
  });
});

describe('DELETE /users/:id', () => {
  test('deletes the user', async () => {
    const res = await request(app)
      .delete(`/users/${createdUserId}`)
      .set(auth());
    expect(res.status).toBe(200);
    createdUserId = null;
  });
});
