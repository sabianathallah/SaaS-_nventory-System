'use strict';
const bcrypt = require('bcryptjs');

const hash = (p) => bcrypt.hashSync(p, 10);
const PASSWORD = 'preface123';

const MARKETING_PERMS = [
  'dashboard.manage', 'dashboard.view_stock', 'dashboard.view_value',
  'dashboard.view_analytics', 'dashboard.view_movements',
  'reports.manage', 'reports.dashboard',
  'db_link.view',
];

const PRODUKSI_PERMS = [
  'dashboard.manage',
  'inventory.manage', 'inventory.view_value',
  'stock.manage',
  'stock.in.view', 'stock.in.create', 'stock.in.scan', 'stock.in.manual_input', 'stock.in.delete', 'stock.in.delete_item',
  'stock.out.view', 'stock.out.create', 'stock.out.scan', 'stock.out.manual_input', 'stock.out.delete', 'stock.out.delete_item',
  'stock.opname.view', 'stock.opname.create', 'stock.opname.scan', 'stock.opname.delete',
  'handover.manage',
  'packing.manage',
  'reports.manage',
  'db_link.manage',
];

const PRODUK_DEV_PERMS = [...MARKETING_PERMS];

module.exports = {
  async up(queryInterface) {
    const now = new Date();

    // ── 1. Get company ──────────────────────────────────────────────────────────
    const [companies] = await queryInterface.sequelize.query(
      `SELECT id FROM "Companies" ORDER BY id LIMIT 1`
    );
    if (!companies.length) throw new Error('No company found. Create a company first.');
    const companyId = companies[0].id;

    // ── 2. Create new roles ─────────────────────────────────────────────────────
    const newRoles = [
      { name: 'MARKETING',          displayName: 'Marketing' },
      { name: 'PRODUKSI',           displayName: 'Produksi' },
      { name: 'PRODUK_DEVELOPMENT', displayName: 'Produk Development' },
    ];

    for (const r of newRoles) {
      // Insert role if not exists for this company
      await queryInterface.sequelize.query(`
        INSERT INTO "Roles" (name, "displayName", "isSystem", "companyId", "createdAt", "updatedAt")
        SELECT :name, :displayName, false, :companyId, :now, :now
        WHERE NOT EXISTS (
          SELECT 1 FROM "Roles" WHERE name = :name AND "companyId" = :companyId
        )
      `, { replacements: { ...r, companyId, now } });

      // Get role id
      const [[role]] = await queryInterface.sequelize.query(
        `SELECT id FROM "Roles" WHERE name = :name AND "companyId" = :companyId LIMIT 1`,
        { replacements: { name: r.name, companyId } }
      );
      if (!role) continue;

      // Assign permissions
      const perms = r.name === 'MARKETING'          ? MARKETING_PERMS
                  : r.name === 'PRODUKSI'            ? PRODUKSI_PERMS
                  : PRODUK_DEV_PERMS;

      for (const key of perms) {
        await queryInterface.sequelize.query(`
          INSERT INTO "RolePermissions" ("roleId", "permissionKey", "createdAt", "updatedAt")
          SELECT :roleId, :key, :now, :now
          WHERE NOT EXISTS (
            SELECT 1 FROM "RolePermissions" WHERE "roleId" = :roleId AND "permissionKey" = :key
          )
        `, { replacements: { roleId: role.id, key, now } });
      }
    }

    // ── 3. Create users ─────────────────────────────────────────────────────────
    const users = [
      { name: 'Sabian Athallah',    email: 'sabianathallah@prefacewearhouse.com',  role: 'SUPER_ADMIN',        companyId: null },
      { name: 'Akbar Fadillah',     email: 'akbarfadillah@prefacewearhouse.com',   role: 'SUPER_ADMIN',        companyId: null },
      { name: 'Albir Lukmansyah',   email: 'albirlukmansyah@prefacewearhouse.com', role: 'COMPANY_ADMIN',      companyId },
      { name: 'Wafi Athallah',      email: 'wafiathallah@prefacewearhouse.com',    role: 'COMPANY_ADMIN',      companyId },
      { name: 'Azzahra Adelia',     email: 'azzahraadelia@prefacewearhouse.com',   role: 'MARKETING',          companyId },
      { name: 'Biana Rizky',        email: 'bianarizky@prefacewearhouse.com',      role: 'PRODUKSI',           companyId },
      { name: 'Ariz Adani',         email: 'arizadani@prefacewearhouse.com',       role: 'PRODUK_DEVELOPMENT', companyId },
      { name: 'Rayfanza Harsa',     email: 'rayfanzaharsa@prefacewearhouse.com',   role: 'OPERASIONAL',        companyId },
      { name: 'Ziyad Musyaffa',     email: 'ziyadmusyaffa@prefacewearhouse.com',   role: 'MARKETING',          companyId },
      { name: 'Dimiyati',           email: 'dimiyati@prefacewearhouse.com',        role: 'OPERASIONAL',        companyId },
    ];

    for (const u of users) {
      await queryInterface.sequelize.query(`
        INSERT INTO "Users" (name, email, password, role, "companyId", "isActive", "createdAt", "updatedAt")
        SELECT :name, :email, :password, :role, :companyId, true, :now, :now
        WHERE NOT EXISTS (SELECT 1 FROM "Users" WHERE email = :email)
      `, { replacements: { ...u, password: hash(PASSWORD), companyId: u.companyId, now } });
    }
  },

  async down(queryInterface) {
    const emails = [
      'sabianathallah@prefacewearhouse.com',
      'akbarfadillah@prefacewearhouse.com',
      'albirlukmansyah@prefacewearhouse.com',
      'wafiathallah@prefacewearhouse.com',
      'azzahraadelia@prefacewearhouse.com',
      'bianarizky@prefacewearhouse.com',
      'arizadani@prefacewearhouse.com',
      'rayfanzaharsa@prefacewearhouse.com',
      'ziyadmusyaffa@prefacewearhouse.com',
      'dimiyati@prefacewearhouse.com',
    ];
    await queryInterface.sequelize.query(
      `DELETE FROM "Users" WHERE email = ANY(ARRAY[:emails]::text[])`,
      { replacements: { emails } }
    );
    await queryInterface.sequelize.query(
      `DELETE FROM "Roles" WHERE name IN ('MARKETING','PRODUKSI','PRODUK_DEVELOPMENT')`
    );
  },
};
