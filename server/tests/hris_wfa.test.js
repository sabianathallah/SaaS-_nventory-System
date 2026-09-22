'use strict';
process.env.NODE_ENV = 'test';

const request = require('supertest');
const app     = require('../app');
const { initDb } = require('./setup');
const { WfaRequest, WfaQuota, Role, RolePermission } = require('../models');

let state;

beforeAll(async () => {
  state = await initDb();
  // OPERASIONAL has no Role/RolePermission rows by default (setup.js only
  // seeds COMPANY_ADMIN) — every /hris/* route requires hris.view, so grant
  // it here (hris_attendance.test.js already creates this role, but Jest
  // runs each test file with its own isolated DB state under --runInBand
  // only if run alone; guard against a duplicate when run together).
  const [opsRole] = await Role.findOrCreate({
    where: { name: 'OPERASIONAL', companyId: state.company.id },
    defaults: { displayName: 'Operasional' },
  });
  await RolePermission.findOrCreate({ where: { roleId: opsRole.id, permissionKey: 'hris.view' } });
});

afterAll(async () => {
  await WfaRequest.destroy({ where: { companyId: state.company.id } }).catch(() => {});
  await WfaQuota.destroy({ where: { companyId: state.company.id } }).catch(() => {});
});

const auth    = () => ({ Authorization: `Bearer ${state.tokens.admin}` });
const opsAuth = () => ({ Authorization: `Bearer ${state.tokens.ops}` });

// Any future date works for these tests; the controller rejects past dates.
const FUTURE_DATE = '2026-12-15';

describe('POST /hris/wfa/requests', () => {
  test('a user can submit a WFA request for a future date', async () => {
    const res = await request(app)
      .post('/hris/wfa/requests')
      .set(opsAuth())
      .send({ date: FUTURE_DATE, reason: 'Kerja dari rumah' });

    expect(res.status).toBe(201);
    expect(res.body.userId).toBe(state.ops.id);
    expect(res.body.status).toBe('PENDING');
  });

  test('rejects a duplicate pending request for the same date', async () => {
    const res = await request(app)
      .post('/hris/wfa/requests')
      .set(opsAuth())
      .send({ date: FUTURE_DATE, reason: 'Duplikat' });
    expect(res.status).toBe(400);
  });

  test('rejects a request for a past date', async () => {
    const res = await request(app)
      .post('/hris/wfa/requests')
      .set(opsAuth())
      .send({ date: '2020-01-01', reason: 'Sudah lewat' });
    expect(res.status).toBe(400);
  });

  test('rejects a request without a date', async () => {
    const res = await request(app)
      .post('/hris/wfa/requests')
      .set(opsAuth())
      .send({ reason: 'no date' });
    expect(res.status).toBe(400);
  });
});

describe('GET /hris/wfa/requests', () => {
  test('OPERASIONAL only sees their own requests', async () => {
    const res = await request(app).get('/hris/wfa/requests').set(opsAuth());
    expect(res.status).toBe(200);
    expect(res.body.data.every(r => r.userId === state.ops.id)).toBe(true);
  });

  test('COMPANY_ADMIN sees all company requests', async () => {
    const res = await request(app).get('/hris/wfa/requests').set(auth());
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
  });
});

describe('PATCH /hris/wfa/requests/:id/review', () => {
  let requestId;

  beforeAll(async () => {
    const req = await WfaRequest.create({
      userId: state.ops.id,
      date: '2026-12-20',
      status: 'PENDING',
      companyId: state.company.id,
    });
    requestId = req.id;
  });

  test('OPERASIONAL cannot review (403)', async () => {
    const res = await request(app)
      .patch(`/hris/wfa/requests/${requestId}/review`)
      .set(opsAuth())
      .send({ status: 'APPROVED' });
    expect(res.status).toBe(403);
  });

  test('admin approves and quota usage increments', async () => {
    const before = await request(app)
      .get('/hris/wfa/quota?month=12&year=2026&userId=' + state.ops.id)
      .set(auth());
    expect(before.status).toBe(200);
    const usedBefore = before.body.used;

    const res = await request(app)
      .patch(`/hris/wfa/requests/${requestId}/review`)
      .set(auth())
      .send({ status: 'APPROVED' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('APPROVED');

    const after = await request(app)
      .get('/hris/wfa/quota?month=12&year=2026&userId=' + state.ops.id)
      .set(auth());
    expect(after.body.used).toBe(usedBefore + 1);
  });

  test('reviewing an already-reviewed request fails', async () => {
    const res = await request(app)
      .patch(`/hris/wfa/requests/${requestId}/review`)
      .set(auth())
      .send({ status: 'APPROVED' });
    expect(res.status).toBe(400);
  });
});

describe('PATCH /hris/wfa/requests/:id/cancel', () => {
  test('a user can cancel their own PENDING request', async () => {
    const created = await request(app)
      .post('/hris/wfa/requests')
      .set(opsAuth())
      .send({ date: '2026-12-25', reason: 'Cancel me' });
    expect(created.status).toBe(201);

    const res = await request(app)
      .patch(`/hris/wfa/requests/${created.body.id}/cancel`)
      .set(opsAuth());
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('CANCELLED');
  });

  test('cannot cancel a request that is not PENDING', async () => {
    const created = await request(app)
      .post('/hris/wfa/requests')
      .set(opsAuth())
      .send({ date: '2026-12-26', reason: 'x' });
    await request(app)
      .patch(`/hris/wfa/requests/${created.body.id}/cancel`)
      .set(opsAuth());

    const res = await request(app)
      .patch(`/hris/wfa/requests/${created.body.id}/cancel`)
      .set(opsAuth());
    expect(res.status).toBe(400);
  });
});

describe('PUT /hris/wfa/quota/adjust', () => {
  test('admin can set a custom quota for a user/month', async () => {
    const res = await request(app)
      .put('/hris/wfa/quota/adjust')
      .set(auth())
      .send({ userId: state.ops.id, month: 11, year: 2026, allocated: 10 });
    expect(res.status).toBe(200);
    expect(res.body.allocated).toBe(10);
  });

  test('OPERASIONAL cannot adjust quota (403)', async () => {
    const res = await request(app)
      .put('/hris/wfa/quota/adjust')
      .set(opsAuth())
      .send({ userId: state.ops.id, month: 11, year: 2026, allocated: 10 });
    expect(res.status).toBe(403);
  });
});
