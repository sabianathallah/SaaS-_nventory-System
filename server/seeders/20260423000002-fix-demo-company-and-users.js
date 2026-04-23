'use strict';
const { hashPassword } = require('../helpers/bcrypt');

/**
 * Fixes demo login credentials.
 *
 * Problems solved:
 * 1. admin/staff users had companyId = null → blocked by login controller
 * 2. staff user had role 'STAFF' which is not a valid role
 * 3. All seeded data had companyId = null → invisible to non-SUPER_ADMIN
 *
 * What this seeder does:
 * 1. Insert demo company "Preface Demo"
 * 2. Fix / upsert demo users with correct roles + companyId
 * 3. Stamp all existing data with the demo company's id
 */

const TABLES_WITH_COMPANY_ID = [
  'Categories',
  'Warehouses',
  'Suppliers',
  'Products',
  'Stocks',
  'Stock_In_Headers',
  'Stock_Out_Headers',
  'Stock_Opname_Sessions',
  'Stock_Movements',
];

const DEMO_USERS = [
  { email: 'superadmin@inventory.local', name: 'Super Admin',      role: 'SUPER_ADMIN',   companyId: null },
  { email: 'admin@inventory.local',      name: 'Admin',            role: 'COMPANY_ADMIN', companyId: null /* filled after company insert */ },
  { email: 'staff@inventory.local',      name: 'Warehouse Staff',  role: 'OPERASIONAL',   companyId: null },
];

module.exports = {
  async up(queryInterface) {
    const now = new Date();

    // ── 1. Insert demo company ──────────────────────────────────────────────
    await queryInterface.bulkInsert('Companies', [{
      name:                  'Preface Demo',
      slug:                  'preface-demo',
      status:                'active',
      subscriptionExpiresAt: new Date('2099-12-31'),
      createdAt:             now,
      updatedAt:             now,
    }], { ignoreDuplicates: true });

    const [[company]] = await queryInterface.sequelize.query(
      `SELECT id FROM "Companies" WHERE slug = 'preface-demo' LIMIT 1`
    );
    const companyId = company.id;

    // ── 2. Fix demo users (delete old → insert corrected) ──────────────────
    const emails = DEMO_USERS.map(u => `'${u.email}'`).join(', ');
    await queryInterface.sequelize.query(
      `DELETE FROM "Users" WHERE email IN (${emails})`
    );

    await queryInterface.bulkInsert('Users', DEMO_USERS.map(u => ({
      name:      u.name,
      email:     u.email,
      password:  hashPassword('password123'),
      role:      u.role,
      companyId: u.role === 'SUPER_ADMIN' ? null : companyId,
      isActive:  true,
      createdAt: now,
      updatedAt: now,
    })));

    // ── 3. Stamp all orphaned seed data with demo companyId ─────────────────
    for (const table of TABLES_WITH_COMPANY_ID) {
      await queryInterface.sequelize.query(
        `UPDATE "${table}" SET "companyId" = ${companyId} WHERE "companyId" IS NULL`
      );
    }
  },

  async down(queryInterface) {
    const [[company]] = await queryInterface.sequelize.query(
      `SELECT id FROM "Companies" WHERE slug = 'preface-demo' LIMIT 1`
    ).catch(() => [[null]]);

    if (!company) return;
    const id = company.id;

    // Revert data stamp
    for (const table of TABLES_WITH_COMPANY_ID) {
      await queryInterface.sequelize.query(
        `UPDATE "${table}" SET "companyId" = NULL WHERE "companyId" = ${id}`
      );
    }

    // Remove demo users
    await queryInterface.sequelize.query(
      `DELETE FROM "Users" WHERE email IN ('superadmin@inventory.local','admin@inventory.local','staff@inventory.local')`
    );

    // Remove demo company
    await queryInterface.bulkDelete('Companies', { slug: 'preface-demo' }, {});
  },
};
