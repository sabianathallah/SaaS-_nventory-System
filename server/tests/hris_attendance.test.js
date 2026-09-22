'use strict';
process.env.NODE_ENV = 'test';

const request = require('supertest');
const app     = require('../app');
const { initDb } = require('./setup');
const { Attendance, Role, RolePermission } = require('../models');

let state;

beforeAll(async () => {
  state = await initDb();
  // OPERASIONAL has no Role/RolePermission rows by default (setup.js only
  // seeds COMPANY_ADMIN) — every /hris/* route requires hris.view, so grant
  // it here to exercise the "self-only" scoping the controller applies.
  const [opsRole] = await Role.findOrCreate({
    where: { name: 'OPERASIONAL', companyId: state.company.id },
    defaults: { displayName: 'Operasional' },
  });
  await RolePermission.findOrCreate({ where: { roleId: opsRole.id, permissionKey: 'hris.view' } });
});

afterAll(async () => {
  await Attendance.destroy({ where: { companyId: state.company.id } }).catch(() => {});
});

const auth    = () => ({ Authorization: `Bearer ${state.tokens.admin}` });
const opsAuth = () => ({ Authorization: `Bearer ${state.tokens.ops}` });

describe('POST /hris/attendance (adminCreate)', () => {
  test('COMPANY_ADMIN can create an attendance record for a user', async () => {
    const res = await request(app)
      .post('/hris/attendance')
      .set(auth())
      .send({
        userId: state.ops.id,
        date: '2026-08-01',
        status: 'PRESENT',
        workMode: 'WFA',
        editReason: 'Set WFA via test',
      });

    expect(res.status).toBe(201);
    expect(res.body.userId).toBe(state.ops.id);
    expect(res.body.workMode).toBe('WFA');
    expect(res.body.status).toBe('PRESENT');
  });

  test('OPERASIONAL cannot create attendance records (403)', async () => {
    const res = await request(app)
      .post('/hris/attendance')
      .set(opsAuth())
      .send({
        userId: state.ops.id,
        date: '2026-08-02',
        workMode: 'ON_SITE',
        editReason: 'test',
      });
    expect(res.status).toBe(403);
  });

  test('returns 400 without editReason', async () => {
    const res = await request(app)
      .post('/hris/attendance')
      .set(auth())
      .send({ userId: state.ops.id, date: '2026-08-03', workMode: 'ON_SITE' });
    expect(res.status).toBe(400);
  });

  test('returns 400 for invalid workMode', async () => {
    const res = await request(app)
      .post('/hris/attendance')
      .set(auth())
      .send({ userId: state.ops.id, date: '2026-08-03', workMode: 'FROM_HOME', editReason: 'test' });
    expect(res.status).toBe(400);
  });

  test('returns 400 when a record for that user/date already exists', async () => {
    const res = await request(app)
      .post('/hris/attendance')
      .set(auth())
      .send({
        userId: state.ops.id,
        date: '2026-08-01',
        workMode: 'ON_SITE',
        editReason: 'duplicate attempt',
      });
    expect(res.status).toBe(400);
  });
});

describe('GET /hris/attendance', () => {
  test('COMPANY_ADMIN sees all company records', async () => {
    const res = await request(app).get('/hris/attendance').set(auth());
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
  });

  test('OPERASIONAL only sees their own records', async () => {
    const res = await request(app).get('/hris/attendance').set(opsAuth());
    expect(res.status).toBe(200);
    expect(res.body.data.every(r => r.userId === state.ops.id)).toBe(true);
  });
});

describe('PATCH /hris/attendance/:id', () => {
  let attendanceId;

  beforeAll(async () => {
    const rec = await Attendance.create({
      userId: state.ops.id,
      date: '2026-07-20',
      companyId: state.company.id,
      status: 'PRESENT',
      workMode: 'ON_SITE',
    });
    attendanceId = rec.id;
  });

  test('admin edits status with editReason', async () => {
    const res = await request(app)
      .patch(`/hris/attendance/${attendanceId}`)
      .set(auth())
      .send({ status: 'LATE', editReason: 'Koreksi manual' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('LATE');
    expect(res.body.editReason).toBe('Koreksi manual');
  });

  test('returns 400 without editReason', async () => {
    const res = await request(app)
      .patch(`/hris/attendance/${attendanceId}`)
      .set(auth())
      .send({ status: 'PRESENT' });
    expect(res.status).toBe(400);
  });

  test('returns 404 for unknown id', async () => {
    const res = await request(app)
      .patch('/hris/attendance/999999')
      .set(auth())
      .send({ status: 'PRESENT', editReason: 'x' });
    expect(res.status).toBe(404);
  });
});

describe('PATCH /hris/attendance/:id/review', () => {
  let fieldAttendanceId;

  beforeAll(async () => {
    const rec = await Attendance.create({
      userId: state.ops.id,
      date: '2026-08-05',
      companyId: state.company.id,
      status: 'PRESENT',
      workMode: 'FIELD',
      reviewStatus: 'PENDING_REVIEW',
      note: 'Kunjungan vendor',
    });
    fieldAttendanceId = rec.id;
  });

  test('OPERASIONAL cannot review (403)', async () => {
    const res = await request(app)
      .patch(`/hris/attendance/${fieldAttendanceId}/review`)
      .set(opsAuth())
      .send({ status: 'APPROVED' });
    expect(res.status).toBe(403);
  });

  test('admin approves a pending field-work claim', async () => {
    const res = await request(app)
      .patch(`/hris/attendance/${fieldAttendanceId}/review`)
      .set(auth())
      .send({ status: 'APPROVED', reviewNote: 'OK' });
    expect(res.status).toBe(200);
    expect(res.body.reviewStatus).toBe('APPROVED');
  });

  test('reviewing an already-reviewed record fails', async () => {
    const res = await request(app)
      .patch(`/hris/attendance/${fieldAttendanceId}/review`)
      .set(auth())
      .send({ status: 'APPROVED' });
    expect(res.status).toBe(400);
  });

  test('rejecting a PRESENT field claim flips status to ABSENT', async () => {
    const rec = await Attendance.create({
      userId: state.ops.id,
      date: '2026-08-06',
      companyId: state.company.id,
      status: 'PRESENT',
      workMode: 'FIELD',
      reviewStatus: 'PENDING_REVIEW',
    });
    const res = await request(app)
      .patch(`/hris/attendance/${rec.id}/review`)
      .set(auth())
      .send({ status: 'REJECTED' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ABSENT');
    expect(res.body.reviewStatus).toBe('REJECTED');
  });
});

describe('GET /hris/attendance/today', () => {
  test("returns null when the caller has no record for today's date", async () => {
    const res = await request(app).get('/hris/attendance/today').set(opsAuth());
    expect(res.status).toBe(200);
    expect(res.body).toBeNull();
  });
});

describe('GET /hris/attendance/summary', () => {
  test('returns a status-count summary for the caller', async () => {
    const res = await request(app)
      .get('/hris/attendance/summary?month=8&year=2026')
      .set(opsAuth());
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('total');
    expect(res.body.total).toBeGreaterThanOrEqual(1);
  });
});
