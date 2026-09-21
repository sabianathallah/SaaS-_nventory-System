'use strict';
process.env.NODE_ENV = 'test';

const request = require('supertest');
const app     = require('../app');
const { initDb } = require('./setup');
const { Project, Task } = require('../models');

let state;
let projectId;
let taskId;

beforeAll(async () => { state = await initDb(); });

afterAll(async () => {
  if (taskId) await Task.destroy({ where: { id: taskId } }).catch(() => {});
  if (projectId) await Project.destroy({ where: { id: projectId } }).catch(() => {});
});

const auth = () => ({ Authorization: `Bearer ${state.tokens.admin}` });

describe('Projects CRUD + task grouping', () => {
  test('POST /projects — creates project', async () => {
    const res = await request(app)
      .post('/projects')
      .set(auth())
      .send({ name: 'Revamp Gudang', color: '#2563EB', dueDate: '2026-12-31' });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Revamp Gudang');
    expect(res.body.status).toBe('ACTIVE');
    // Creator jadi PIC default kalau ownerId tidak dikirim.
    expect(res.body.ownerId).toBe(state.admin.id);
    projectId = res.body.id;
  });

  test('POST /projects — returns 400 for missing name', async () => {
    const res = await request(app).post('/projects').set(auth()).send({});
    expect(res.status).toBe(400);
  });

  test('GET /projects — lists projects with task counters', async () => {
    const res = await request(app).get('/projects').set(auth());
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    const row = res.body.find(p => p.id === projectId);
    expect(row).toBeTruthy();
    expect(Number(row.taskCount)).toBe(0);
    expect(Number(row.doneCount)).toBe(0);
  });

  test('POST /tasks — task can be attached to a project', async () => {
    const res = await request(app)
      .post('/tasks')
      .set(auth())
      .send({ title: 'Pindah rak gudang', projectId });

    expect(res.status).toBe(201);
    expect(res.body.projectId).toBe(projectId);
    expect(res.body.project.name).toBe('Revamp Gudang');
    taskId = res.body.id;
  });

  test('GET /tasks?projectId — filters to that project only', async () => {
    const res = await request(app).get(`/tasks?projectId=${projectId}`).set(auth());
    expect(res.status).toBe(200);
    expect(res.body.data.every(t => t.projectId === projectId)).toBe(true);
    expect(res.body.data.some(t => t.id === taskId)).toBe(true);
  });

  test('GET /projects/:id — counters follow task completion', async () => {
    await request(app).put(`/tasks/${taskId}`).set(auth()).send({ status: 'DONE' });

    const res = await request(app).get(`/projects/${projectId}`).set(auth());
    expect(res.status).toBe(200);
    expect(Number(res.body.taskCount)).toBe(1);
    expect(Number(res.body.doneCount)).toBe(1);
  });

  test('PUT /projects/:id — updates status', async () => {
    const res = await request(app)
      .put(`/projects/${projectId}`)
      .set(auth())
      .send({ status: 'ON_HOLD' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ON_HOLD');
  });

  test('DELETE /projects/:id — releases its tasks instead of deleting them', async () => {
    const res = await request(app).delete(`/projects/${projectId}`).set(auth());
    expect(res.status).toBe(200);

    const task = await Task.findByPk(taskId);
    expect(task).not.toBeNull();
    expect(task.projectId).toBeNull();
    projectId = null;
  });
});
