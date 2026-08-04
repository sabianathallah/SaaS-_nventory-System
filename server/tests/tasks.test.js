'use strict';
process.env.NODE_ENV = 'test';

const request = require('supertest');
const app     = require('../app');
const { initDb } = require('./setup');
const { signToken } = require('../helpers/jwt');
const { Task, User } = require('../models');

let state;
let coworker; // second OPERASIONAL user, used as an assignee

beforeAll(async () => {
  state = await initDb();
  coworker = await User.create({
    name: 'Coworker User',
    email: 'coworker@test.com',
    password: 'password123',
    role: 'OPERASIONAL',
    companyId: state.company.id,
    isActive: true,
  });
  coworker.token = signToken({ id: coworker.id, email: coworker.email, role: 'OPERASIONAL', companyId: state.company.id });
});

afterAll(async () => {
  await Task.destroy({ where: { companyId: state.company.id } }).catch(() => {});
  await User.destroy({ where: { id: coworker.id } }).catch(() => {});
});

const auth       = () => ({ Authorization: `Bearer ${state.tokens.admin}` });
const opsAuth    = () => ({ Authorization: `Bearer ${state.tokens.ops}` });
const coworkerAuth = () => ({ Authorization: `Bearer ${coworker.token}` });

describe('POST /tasks', () => {
  test('creates a task with the creator as owner', async () => {
    const res = await request(app)
      .post('/tasks')
      .set(opsAuth())
      .send({ title: 'Rekap laporan bulanan', priority: 'HIGH' });

    expect(res.status).toBe(201);
    expect(res.body.title).toBe('Rekap laporan bulanan');
    expect(res.body.status).toBe('TODO');
    expect(res.body.creator.id).toBe(state.ops.id);
  });

  test('returns 400 without a title', async () => {
    const res = await request(app)
      .post('/tasks')
      .set(opsAuth())
      .send({ priority: 'LOW' });
    expect(res.status).toBe(400);
  });

  test('assigning to a coworker notifies them and sets PENDING status', async () => {
    const res = await request(app)
      .post('/tasks')
      .set(opsAuth())
      .send({ title: 'Review dokumen', assigneeIds: [coworker.id] });

    expect(res.status).toBe(201);
    const link = res.body.assignees.find(a => a.id === coworker.id);
    expect(link).toBeDefined();
    expect(link.TaskAssignee.assignmentStatus).toBe('PENDING');
  });
});

describe('GET /tasks/:id and PUT /tasks/:id', () => {
  let taskId;

  beforeAll(async () => {
    const res = await request(app)
      .post('/tasks')
      .set(opsAuth())
      .send({ title: 'Task untuk diedit' });
    taskId = res.body.id;
  });

  test('creator can fetch the task', async () => {
    const res = await request(app).get(`/tasks/${taskId}`).set(opsAuth());
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(taskId);
  });

  test('a user with no access to the task gets 403', async () => {
    const res = await request(app).get(`/tasks/${taskId}`).set(coworkerAuth());
    expect(res.status).toBe(403);
  });

  test('creator can update status to DONE', async () => {
    const res = await request(app)
      .put(`/tasks/${taskId}`)
      .set(opsAuth())
      .send({ status: 'DONE' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('DONE');
    expect(res.body.completedAt).not.toBeNull();
  });
});

describe('sub-task completion gate', () => {
  let parentId;
  let subtaskId;

  beforeAll(async () => {
    const parentRes = await request(app)
      .post('/tasks')
      .set(opsAuth())
      .send({ title: 'Parent task' });
    parentId = parentRes.body.id;

    const subRes = await request(app)
      .post('/tasks')
      .set(opsAuth())
      .send({ title: 'Sub-task 1', parentTaskId: parentId });
    subtaskId = subRes.body.id;
  });

  test('cannot mark the parent DONE while a sub-task is still open', async () => {
    const res = await request(app)
      .put(`/tasks/${parentId}`)
      .set(opsAuth())
      .send({ status: 'DONE' });
    expect(res.status).toBe(400);
  });

  test('completing the sub-task bumps the parent to IN_PROGRESS', async () => {
    const res = await request(app)
      .put(`/tasks/${subtaskId}`)
      .set(opsAuth())
      .send({ status: 'DONE' });
    expect(res.status).toBe(200);

    const parent = await request(app).get(`/tasks/${parentId}`).set(opsAuth());
    expect(parent.body.status).toBe('IN_PROGRESS');
  });

  test('parent can now be marked DONE', async () => {
    const res = await request(app)
      .put(`/tasks/${parentId}`)
      .set(opsAuth())
      .send({ status: 'DONE' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('DONE');
  });
});

describe('accept / reject flow', () => {
  let taskId;

  beforeAll(async () => {
    const res = await request(app)
      .post('/tasks')
      .set(opsAuth())
      .send({ title: 'Assigned task', assigneeIds: [coworker.id] });
    taskId = res.body.id;
  });

  test('a non-assignee cannot accept', async () => {
    const res = await request(app).post(`/tasks/${taskId}/accept`).set(opsAuth());
    // creator is not an assignee here (self was not included), so no link exists
    expect(res.status).toBe(403);
  });

  test('assignee can accept the task', async () => {
    const res = await request(app).post(`/tasks/${taskId}/accept`).set(coworkerAuth());
    expect(res.status).toBe(200);
    const link = res.body.assignees.find(a => a.id === coworker.id);
    expect(link.TaskAssignee.assignmentStatus).toBe('ACCEPTED');
  });

  test('cannot respond twice', async () => {
    const res = await request(app).post(`/tasks/${taskId}/accept`).set(coworkerAuth());
    expect(res.status).toBe(400);
  });

  test('rejecting requires a note', async () => {
    const res2 = await request(app)
      .post('/tasks')
      .set(opsAuth())
      .send({ title: 'Assigned task 2', assigneeIds: [coworker.id] });

    const withoutNote = await request(app).post(`/tasks/${res2.body.id}/reject`).set(coworkerAuth());
    expect(withoutNote.status).toBe(400);

    const withNote = await request(app)
      .post(`/tasks/${res2.body.id}/reject`)
      .set(coworkerAuth())
      .send({ note: 'Lagi sibuk' });
    expect(withNote.status).toBe(200);
    const link = withNote.body.assignees.find(a => a.id === coworker.id);
    expect(link.TaskAssignee.assignmentStatus).toBe('REJECTED');
  });
});

describe('DELETE /tasks/:id', () => {
  test('creator can delete their own task', async () => {
    const created = await request(app)
      .post('/tasks')
      .set(opsAuth())
      .send({ title: 'To be deleted' });

    const res = await request(app).delete(`/tasks/${created.body.id}`).set(opsAuth());
    expect(res.status).toBe(200);

    const getRes = await request(app).get(`/tasks/${created.body.id}`).set(opsAuth());
    expect(getRes.status).toBe(404);
  });

  test('a user with no access cannot delete', async () => {
    const created = await request(app)
      .post('/tasks')
      .set(opsAuth())
      .send({ title: 'Not yours' });

    const res = await request(app).delete(`/tasks/${created.body.id}`).set(coworkerAuth());
    expect(res.status).toBe(403);
  });
});

describe('GET /tasks', () => {
  test('lists tasks visible to the caller', async () => {
    const res = await request(app).get('/tasks').set(opsAuth());
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});
