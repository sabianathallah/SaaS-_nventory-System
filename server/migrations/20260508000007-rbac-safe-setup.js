'use strict';
const { ALL_PERMISSIONS, DEFAULT_PERMISSIONS, SYSTEM_ROLES } = require('../helpers/permissions');

const DISPLAY_NAMES = {
  SUPER_ADMIN: 'Super Admin', ADMIN: 'Admin', COMPANY_ADMIN: 'Company Admin',
  OPERASIONAL: 'Operasional', HEAD_PACKING: 'Head Packing', TIM_PACKING: 'Tim Packing',
  HR: 'HR', CEO: 'CEO', STAFF: 'Staff',
};

module.exports = {
  async up(queryInterface, Sequelize) {
    const Q   = queryInterface.sequelize.QueryTypes.SELECT;
    const now = new Date();

    // ── 1. Permissions table ────────────────────────────────────────────────
    await queryInterface.sequelize.query(`
      CREATE TABLE IF NOT EXISTS "Permissions" (
        id           SERIAL PRIMARY KEY,
        key          VARCHAR(100) NOT NULL UNIQUE,
        label        VARCHAR(200) NOT NULL,
        "group"      VARCHAR(100),
        "createdAt"  TIMESTAMP WITH TIME ZONE NOT NULL,
        "updatedAt"  TIMESTAMP WITH TIME ZONE NOT NULL
      )
    `);

    for (const p of ALL_PERMISSIONS) {
      await queryInterface.sequelize.query(
        `INSERT INTO "Permissions" (key, label, "group", "createdAt", "updatedAt")
         VALUES (:key, :label, :group, :now, :now)
         ON CONFLICT (key) DO UPDATE SET label = :label, "group" = :group`,
        { replacements: { key: p.key, label: p.label, group: p.group, now } }
      );
    }

    // ── 2. Roles table ──────────────────────────────────────────────────────
    await queryInterface.sequelize.query(`
      CREATE TABLE IF NOT EXISTS "Roles" (
        id            SERIAL PRIMARY KEY,
        name          VARCHAR(100) NOT NULL,
        "displayName" VARCHAR(200) NOT NULL,
        "companyId"   INTEGER REFERENCES "Companies"(id) ON UPDATE CASCADE ON DELETE CASCADE,
        "isSystem"    BOOLEAN NOT NULL DEFAULT false,
        "createdAt"   TIMESTAMP WITH TIME ZONE NOT NULL,
        "updatedAt"   TIMESTAMP WITH TIME ZONE NOT NULL
      )
    `);

    // Unique index (safe)
    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS roles_name_companyid_unique
      ON "Roles" (name) WHERE "companyId" IS NULL
    `);
    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS roles_name_companyid_company_unique
      ON "Roles" (name, "companyId") WHERE "companyId" IS NOT NULL
    `);

    // ── 3. Seed all default roles ───────────────────────────────────────────
    for (const name of Object.keys(DEFAULT_PERMISSIONS)) {
      const displayName = DISPLAY_NAMES[name] ?? name;
      const isSystem    = SYSTEM_ROLES.includes(name);
      const existing    = await queryInterface.sequelize.query(
        `SELECT id FROM "Roles" WHERE name = :name AND "companyId" IS NULL LIMIT 1`,
        { type: Q, replacements: { name } }
      );
      if (existing.length === 0) {
        await queryInterface.sequelize.query(
          `INSERT INTO "Roles" (name, "displayName", "companyId", "isSystem", "createdAt", "updatedAt")
           VALUES (:name, :displayName, NULL, :isSystem, :now, :now)`,
          { replacements: { name, displayName, isSystem, now } }
        );
      } else {
        await queryInterface.sequelize.query(
          `UPDATE "Roles" SET "displayName" = :displayName, "updatedAt" = :now WHERE id = :id`,
          { replacements: { displayName, now, id: existing[0].id } }
        );
      }
    }

    // ── 4. RolePermissions table (new schema with FK) ───────────────────────
    // Check if old schema (has 'role' column) still exists → migrate it
    const cols = await queryInterface.sequelize.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'RolePermissions' AND column_name = 'role'`,
      { type: Q }
    );

    if (cols.length > 0) {
      // Old schema exists — snapshot data then drop
      const oldRows = await queryInterface.sequelize.query(
        `SELECT role, permissions, "companyId" FROM "RolePermissions"`,
        { type: Q }
      );
      await queryInterface.sequelize.query(`DROP TABLE "RolePermissions"`);

      // Create new schema
      await queryInterface.sequelize.query(`
        CREATE TABLE "RolePermissions" (
          id             SERIAL PRIMARY KEY,
          "roleId"       INTEGER NOT NULL REFERENCES "Roles"(id) ON UPDATE CASCADE ON DELETE CASCADE,
          "permissionKey" VARCHAR(100) NOT NULL,
          "createdAt"    TIMESTAMP WITH TIME ZONE NOT NULL,
          "updatedAt"    TIMESTAMP WITH TIME ZONE NOT NULL,
          UNIQUE ("roleId", "permissionKey")
        )
      `);

      // Migrate old data
      for (const row of oldRows) {
        const perms = Array.isArray(row.permissions)
          ? row.permissions
          : JSON.parse(row.permissions ?? '[]');
        if (!perms.length) continue;

        const roleRows = await queryInterface.sequelize.query(
          `SELECT id FROM "Roles" WHERE name = :name AND "companyId" IS NULL LIMIT 1`,
          { type: Q, replacements: { name: row.role } }
        );
        if (!roleRows.length) continue;
        const roleId = roleRows[0].id;

        for (const key of perms) {
          await queryInterface.sequelize.query(
            `INSERT INTO "RolePermissions" ("roleId", "permissionKey", "createdAt", "updatedAt")
             VALUES (:roleId, :key, :now, :now)
             ON CONFLICT ("roleId", "permissionKey") DO NOTHING`,
            { replacements: { roleId, key, now } }
          );
        }
      }
    } else {
      // New schema — create if not exists
      await queryInterface.sequelize.query(`
        CREATE TABLE IF NOT EXISTS "RolePermissions" (
          id             SERIAL PRIMARY KEY,
          "roleId"       INTEGER NOT NULL REFERENCES "Roles"(id) ON UPDATE CASCADE ON DELETE CASCADE,
          "permissionKey" VARCHAR(100) NOT NULL,
          "createdAt"    TIMESTAMP WITH TIME ZONE NOT NULL,
          "updatedAt"    TIMESTAMP WITH TIME ZONE NOT NULL,
          UNIQUE ("roleId", "permissionKey")
        )
      `);
    }

    // ── 5. Seed permissions for all default roles ───────────────────────────
    for (const [name, perms] of Object.entries(DEFAULT_PERMISSIONS)) {
      const roleRows = await queryInterface.sequelize.query(
        `SELECT id FROM "Roles" WHERE name = :name AND "companyId" IS NULL LIMIT 1`,
        { type: Q, replacements: { name } }
      );
      if (!roleRows.length) continue;
      const roleId = roleRows[0].id;

      // Only insert if role has NO permissions yet (don't overwrite custom ones)
      const existingPerms = await queryInterface.sequelize.query(
        `SELECT "permissionKey" FROM "RolePermissions" WHERE "roleId" = :roleId`,
        { type: Q, replacements: { roleId } }
      );
      if (existingPerms.length > 0) continue;

      for (const key of perms) {
        await queryInterface.sequelize.query(
          `INSERT INTO "RolePermissions" ("roleId", "permissionKey", "createdAt", "updatedAt")
           VALUES (:roleId, :key, :now, :now)
           ON CONFLICT ("roleId", "permissionKey") DO NOTHING`,
          { replacements: { roleId, key, now } }
        );
      }
    }
  },

  async down() {},
};
