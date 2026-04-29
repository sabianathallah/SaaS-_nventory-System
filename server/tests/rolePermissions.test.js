'use strict';
process.env.NODE_ENV = 'test';

const request = require('supertest');
const app     = require('../app');
const { initDb }        = require('./setup');
const { RolePermission } = require('../models');
const { DEFAULT_PERMISSIONS, EDITABLE_ROLES } = require('../helpers/permissions');

let state;

beforeAll(async () => { state = await initDb(); });

afterAll(async () => {
  // Clean up any custom permission rows created during tests
  await RolePermission.destroy({ where: { companyId: state.company.id } }).catch(() => {});
});

const auth      = () => ({ Authorization: `Bearer ${state.tokens.admin}` });
const superAuth = () => ({ Authorization: `Bearer ${state.tokens.superAdmin}` });

describe('GET /role-permissions', () => {
  test('returns allPermissions list and permissions per role', async () => {
    const res = await request(app).get('/role-permissions').set(auth());

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('allPermissions');
    expect(res.body).toHaveProperty('permissions');
    expect(Array.isArray(res.body.allPermissions)).toBe(true);
    expect(res.body.allPermissions.length).toBeGreaterThan(0);
  });

  test('allPermissions has key, label, and group for each entry', async () => {
    const res = await request(app).get('/role-permissions').set(auth());
    res.body.allPermissions.forEach(p => {
      expect(p).toHaveProperty('key');
      expect(p).toHaveProperty('label');
      expect(p).toHaveProperty('group');
    });
  });

  test('permissions contains all editable roles', async () => {
    const res = await request(app).get('/role-permissions').set(auth());
    EDITABLE_ROLES.forEach(role => {
      expect(res.body.permissions).toHaveProperty(role);
      expect(Array.isArray(res.body.permissions[role])).toBe(true);
    });
  });

  test('fresh roles default to DEFAULT_PERMISSIONS values', async () => {
    const res = await request(app).get('/role-permissions').set(auth());
    const opsPerms = res.body.permissions['OPERASIONAL'];
    DEFAULT_PERMISSIONS['OPERASIONAL'].forEach(key => {
      expect(opsPerms).toContain(key);
    });
  });
});

describe('PUT /role-permissions/:role', () => {
  test('saves custom permissions for OPERASIONAL', async () => {
    const customPerms = ['inventory.view', 'stock.view'];
    const res = await request(app)
      .put('/role-permissions/OPERASIONAL')
      .set(auth())
      .send({ permissions: customPerms });

    expect(res.status).toBe(200);
    expect(res.body.role).toBe('OPERASIONAL');
    expect(res.body.permissions).toEqual(customPerms);
  });

  test('GET reflects the saved custom permissions', async () => {
    const res = await request(app).get('/role-permissions').set(auth());
    expect(res.body.permissions['OPERASIONAL']).toEqual(['inventory.view', 'stock.view']);
  });

  test('invalid permission keys are silently filtered out', async () => {
    const res = await request(app)
      .put('/role-permissions/OPERASIONAL')
      .set(auth())
      .send({ permissions: ['inventory.view', 'not.a.real.key'] });

    expect(res.status).toBe(200);
    expect(res.body.permissions).toContain('inventory.view');
    expect(res.body.permissions).not.toContain('not.a.real.key');
  });

  test('returns 400 for non-editable role (SUPER_ADMIN)', async () => {
    const res = await request(app)
      .put('/role-permissions/SUPER_ADMIN')
      .set(auth())
      .send({ permissions: ['inventory.view'] });
    expect(res.status).toBe(400);
  });

  test('returns 400 for non-editable role (ADMIN)', async () => {
    const res = await request(app)
      .put('/role-permissions/ADMIN')
      .set(auth())
      .send({ permissions: ['inventory.view'] });
    expect(res.status).toBe(400);
  });

  test('returns 400 when permissions is not an array', async () => {
    const res = await request(app)
      .put('/role-permissions/OPERASIONAL')
      .set(auth())
      .send({ permissions: 'inventory.view' });
    expect(res.status).toBe(400);
  });

  test('SUPER_ADMIN can update permissions for another company', async () => {
    const res = await request(app)
      .put('/role-permissions/CEO')
      .set(superAuth())
      .send({ permissions: ['reports.dashboard'] });
    expect(res.status).toBe(200);
    expect(res.body.permissions).toContain('reports.dashboard');
  });
});

describe('DELETE /role-permissions/:role (reset to default)', () => {
  test('resets OPERASIONAL permissions back to default', async () => {
    // First set custom
    await request(app)
      .put('/role-permissions/OPERASIONAL')
      .set(auth())
      .send({ permissions: ['inventory.view'] });

    // Then reset
    const res = await request(app)
      .delete('/role-permissions/OPERASIONAL')
      .set(auth());

    expect(res.status).toBe(200);
    expect(res.body.role).toBe('OPERASIONAL');
    // Should return the default permissions list
    DEFAULT_PERMISSIONS['OPERASIONAL'].forEach(key => {
      expect(res.body.permissions).toContain(key);
    });
  });

  test('GET after reset shows default permissions', async () => {
    const res = await request(app).get('/role-permissions').set(auth());
    DEFAULT_PERMISSIONS['OPERASIONAL'].forEach(key => {
      expect(res.body.permissions['OPERASIONAL']).toContain(key);
    });
  });

  test('returns 400 when trying to reset non-editable role', async () => {
    const res = await request(app)
      .delete('/role-permissions/SUPER_ADMIN')
      .set(auth());
    expect(res.status).toBe(400);
  });
});

describe('Permission isolation by company', () => {
  test('SUPER_ADMIN sees permissions for companyId=null (global)', async () => {
    const res = await request(app).get('/role-permissions').set(superAuth());
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('permissions');
  });

  test('COMPANY_ADMIN sees permissions scoped to their company', async () => {
    const res = await request(app).get('/role-permissions').set(auth());
    expect(res.status).toBe(200);
    // All roles should be present
    EDITABLE_ROLES.forEach(role => {
      expect(res.body.permissions).toHaveProperty(role);
    });
  });
});
