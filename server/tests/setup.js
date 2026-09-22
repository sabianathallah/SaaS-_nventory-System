'use strict';

// Must be set before ANY model/app require
process.env.NODE_ENV = 'test';

const { signToken } = require('../helpers/jwt');
const { hashPassword } = require('../helpers/bcrypt');
const { ALL_KEYS } = (() => {
  const { ALL_PERMISSIONS } = require('../helpers/permissions');
  return { ALL_KEYS: ALL_PERMISSIONS.map(p => p.key) };
})();

let _initialized = false;
let _state = null;

/**
 * Syncs the test DB (force: true) exactly once per process, then seeds
 * base fixtures that every test file can reference.
 *
 * Returns { company, superAdmin, admin, ops, tokens, category, warehouse }
 */
async function initDb() {
  if (_initialized) return _state;

  const {
    sequelize, Company, User, Category, Warehouse, Role, RolePermission, Permission,
  } = require('../models');

  await sequelize.sync({ force: true });
  _initialized = true;

  // ── Seed base data ─────────────────────────────────────────────────────────

  const company = await Company.create({
    name: 'Test Company',
    slug: 'test-company',
    status: 'active',
  });

  // Passwords are hashed by the beforeCreate hook on User
  const superAdmin = await User.create({
    name: 'Super Admin',
    email: 'superadmin@test.com',
    password: 'password123',
    role: 'SUPER_ADMIN',
    isActive: true,
  });

  const admin = await User.create({
    name: 'Company Admin',
    email: 'admin@test.com',
    password: 'password123',
    role: 'COMPANY_ADMIN',
    companyId: company.id,
    isActive: true,
  });

  const ops = await User.create({
    name: 'Operasional User',
    email: 'ops@test.com',
    password: 'password123',
    role: 'OPERASIONAL',
    companyId: company.id,
    isActive: true,
  });

  // Tokens for each role (signed with the same secret the app uses)
  const tokens = {
    superAdmin: signToken({ id: superAdmin.id, email: superAdmin.email, role: 'SUPER_ADMIN', companyId: null }),
    admin:      signToken({ id: admin.id,       email: admin.email,      role: 'COMPANY_ADMIN', companyId: company.id }),
    ops:        signToken({ id: ops.id,         email: ops.email,        role: 'OPERASIONAL',   companyId: company.id }),
  };

  // Seed Permission catalogue so GET /permissions returns data
  const { ALL_PERMISSIONS: ALL_PERMS } = require('../helpers/permissions');
  await Permission.bulkCreate(
    ALL_PERMS.map(p => ({ key: p.key, label: p.label, group: p.group })),
    { ignoreDuplicates: true }
  );

  // Seed Role + RolePermissions so requirePermission middleware passes for COMPANY_ADMIN
  const adminRole = await Role.create({ name: 'COMPANY_ADMIN', displayName: 'Company Admin', companyId: company.id });
  await RolePermission.bulkCreate(ALL_KEYS.map(key => ({ roleId: adminRole.id, permissionKey: key })));

  const category = await Category.create({ name: 'Test Category', companyId: company.id });
  const warehouse = await Warehouse.create({ name: 'Test Warehouse', location: 'Jakarta', companyId: company.id });

  _state = { company, superAdmin, admin, ops, tokens, category, warehouse };
  return _state;
}

/** Call in afterAll of the LAST test file or use forceExit. */
async function closeDb() {
  const { sequelize } = require('../models');
  await sequelize.close();
}

module.exports = { initDb, closeDb };
