'use strict';
process.env.NODE_ENV = 'test';

const request = require('supertest');
const app     = require('../app');
const { initDb }          = require('./setup');
const { Role, RolePermission } = require('../models');

let state;
let opsRoleId;
let systemRoleId;
let customRoleId;

beforeAll(async () => {
  state = await initDb();

  // OPERASIONAL role untuk test update permissions
  const opsRole = await Role.create({
    name: 'OPERASIONAL', displayName: 'Operasional',
    companyId: state.company.id, isSystem: false,
  });
  opsRoleId = opsRole.id;
  await RolePermission.bulkCreate(
    ['stock.view', 'inventory.view'].map(k => ({ roleId: opsRoleId, permissionKey: k }))
  );

  // System role untuk test block edit/delete
  const sysRole = await Role.create({
    name: 'TEST_SYSTEM_ROLE', displayName: 'System Role',
    companyId: state.company.id, isSystem: true,
  });
  systemRoleId = sysRole.id;
});

afterAll(async () => {
  await RolePermission.destroy({ where: {} }).catch(() => {});
  await Role.destroy({ where: { companyId: state.company.id } }).catch(() => {});
});

const auth      = () => ({ Authorization: `Bearer ${state.tokens.admin}` });
const superAuth = () => ({ Authorization: `Bearer ${state.tokens.superAdmin}` });

// ── GET /permissions ──────────────────────────────────────────────────────────

describe('GET /permissions', () => {
  test('returns permission list', async () => {
    const res = await request(app).get('/permissions').set(auth());
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  test('each entry has key, label, and group', async () => {
    const res = await request(app).get('/permissions').set(auth());
    res.body.forEach(p => {
      expect(p).toHaveProperty('key');
      expect(p).toHaveProperty('label');
      expect(p).toHaveProperty('group');
    });
  });
});

// ── GET /roles ────────────────────────────────────────────────────────────────

describe('GET /roles', () => {
  test('returns array of roles with permissions', async () => {
    const res = await request(app).get('/roles').set(auth());
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    res.body.forEach(r => {
      expect(r).toHaveProperty('id');
      expect(r).toHaveProperty('name');
      expect(r).toHaveProperty('permissions');
      expect(Array.isArray(r.permissions)).toBe(true);
    });
  });

  test('COMPANY_ADMIN sees company-scoped + global roles', async () => {
    const res = await request(app).get('/roles').set(auth());
    expect(res.status).toBe(200);
    const names = res.body.map(r => r.name);
    expect(names).toContain('COMPANY_ADMIN');
    expect(names).toContain('OPERASIONAL');
  });

  test('SUPER_ADMIN can list roles', async () => {
    const res = await request(app).get('/roles').set(superAuth());
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('OPERASIONAL role has expected permissions', async () => {
    const res = await request(app).get('/roles').set(auth());
    const opsRole = res.body.find(r => r.name === 'OPERASIONAL');
    expect(opsRole).toBeDefined();
    expect(opsRole.permissions).toContain('stock.view');
    expect(opsRole.permissions).toContain('inventory.view');
  });
});

// ── POST /roles ───────────────────────────────────────────────────────────────

describe('POST /roles — create custom role', () => {
  test('creates a new custom role with permissions', async () => {
    const res = await request(app)
      .post('/roles')
      .set(auth())
      .send({ name: 'CUSTOM_TEST_ROLE', displayName: 'Custom Role', permissions: ['inventory.view'] });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe('CUSTOM_TEST_ROLE');
    expect(res.body.permissions).toContain('inventory.view');
    customRoleId = res.body.id;
  });

  test('returns 400 when name is missing', async () => {
    const res = await request(app)
      .post('/roles')
      .set(auth())
      .send({ displayName: 'No Name' });
    expect(res.status).toBe(400);
  });

  test('returns 409 on duplicate role name', async () => {
    const res = await request(app)
      .post('/roles')
      .set(auth())
      .send({ name: 'CUSTOM_TEST_ROLE', displayName: 'Duplicate' });
    expect(res.status).toBe(409);
  });
});

// ── PUT /roles/:id ────────────────────────────────────────────────────────────

describe('PUT /roles/:id — update permissions', () => {
  test('updates permissions for a custom role', async () => {
    const res = await request(app)
      .put(`/roles/${customRoleId}`)
      .set(auth())
      .send({ permissions: ['stock.view', 'inventory.view'] });

    expect(res.status).toBe(200);
    expect(res.body.permissions).toContain('stock.view');
    expect(res.body.permissions).toContain('inventory.view');
  });

  test('GET /roles reflects updated permissions', async () => {
    const res = await request(app).get('/roles').set(auth());
    const role = res.body.find(r => r.id === customRoleId);
    expect(role).toBeDefined();
    expect(role.permissions).toContain('stock.view');
  });

  test('can update displayName only', async () => {
    const res = await request(app)
      .put(`/roles/${customRoleId}`)
      .set(auth())
      .send({ displayName: 'Updated Display Name' });
    expect(res.status).toBe(200);
    expect(res.body.displayName).toBe('Updated Display Name');
  });

  test('returns 400 when editing a system role', async () => {
    const res = await request(app)
      .put(`/roles/${systemRoleId}`)
      .set(auth())
      .send({ permissions: ['inventory.view'] });
    expect(res.status).toBe(400);
  });

  test('returns 404 for non-existent role id', async () => {
    const res = await request(app)
      .put('/roles/999999')
      .set(auth())
      .send({ permissions: ['inventory.view'] });
    expect(res.status).toBe(404);
  });
});

// ── DELETE /roles/:id ─────────────────────────────────────────────────────────

describe('DELETE /roles/:id — delete custom role', () => {
  test('deletes a custom role', async () => {
    const res = await request(app)
      .delete(`/roles/${customRoleId}`)
      .set(auth());
    expect(res.status).toBe(200);
  });

  test('GET /roles no longer contains deleted role', async () => {
    const res = await request(app).get('/roles').set(auth());
    const names = res.body.map(r => r.name);
    expect(names).not.toContain('CUSTOM_TEST_ROLE');
  });

  test('returns 400 when deleting a system role', async () => {
    const res = await request(app)
      .delete(`/roles/${systemRoleId}`)
      .set(auth());
    expect(res.status).toBe(400);
  });

  test('returns 404 for non-existent role id', async () => {
    const res = await request(app)
      .delete('/roles/999999')
      .set(auth());
    expect(res.status).toBe(404);
  });
});
