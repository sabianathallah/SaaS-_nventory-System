'use strict';
process.env.NODE_ENV = 'test';

const request = require('supertest');
const app     = require('../app');
const { initDb } = require('./setup');

let state;

beforeAll(async () => { state = await initDb(); });

describe('POST /login', () => {
  test('returns 200 with access_token and permissions for valid credentials', async () => {
    const res = await request(app)
      .post('/login')
      .send({ email: 'admin@test.com', password: 'password123' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('access_token');
    expect(res.body.user).toMatchObject({
      email: 'admin@test.com',
      role:  'COMPANY_ADMIN',
    });
    expect(Array.isArray(res.body.user.permissions)).toBe(true);
  });

  test('returns 200 for SUPER_ADMIN (no company required)', async () => {
    const res = await request(app)
      .post('/login')
      .send({ email: 'superadmin@test.com', password: 'password123' });

    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('SUPER_ADMIN');
  });

  test('returns 401 for wrong password', async () => {
    const res = await request(app)
      .post('/login')
      .send({ email: 'admin@test.com', password: 'wrongpassword' });

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('message');
  });

  test('returns 401 for non-existent email', async () => {
    const res = await request(app)
      .post('/login')
      .send({ email: 'nobody@test.com', password: 'password123' });

    expect(res.status).toBe(401);
  });

  test('returns 400 when email or password is missing', async () => {
    const res = await request(app)
      .post('/login')
      .send({ email: 'admin@test.com' });

    expect(res.status).toBe(400);
  });
});

describe('Protected routes — token validation', () => {
  test('returns 401 when Authorization header is missing', async () => {
    const res = await request(app).get('/warehouses');
    expect(res.status).toBe(401);
  });

  test('returns 401 for a garbage token', async () => {
    const res = await request(app)
      .get('/warehouses')
      .set('Authorization', 'Bearer totally-invalid-token');
    expect(res.status).toBe(401);
  });

  test('returns 200 with a valid token', async () => {
    const res = await request(app)
      .get('/warehouses')
      .set('Authorization', `Bearer ${state.tokens.admin}`);
    expect(res.status).toBe(200);
  });
});
