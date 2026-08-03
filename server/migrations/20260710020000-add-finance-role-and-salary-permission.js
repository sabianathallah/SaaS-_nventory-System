'use strict';
const { ALL_PERMISSIONS, DEFAULT_PERMISSIONS } = require('../helpers/permissions');

module.exports = {
  async up(queryInterface) {
    const now = new Date();

    // Upsert seluruh katalog permission (termasuk hris.salary.manage yang baru,
    // dan label/desc hris.payslip.manage yang menyempit ke slip gaji saja).
    for (const p of ALL_PERMISSIONS) {
      await queryInterface.sequelize.query(
        `INSERT INTO "Permissions" (key, label, "group", "createdAt", "updatedAt")
         VALUES (:key, :label, :group, :now, :now)
         ON CONFLICT (key) DO UPDATE SET label = :label, "group" = :group, "updatedAt" = :now`,
        { replacements: { key: p.key, label: p.label, group: p.group, now } }
      );
    }

    // Role FINANCE (global, bukan per-company)
    await queryInterface.sequelize.query(
      `INSERT INTO "Roles" (name, "displayName", "companyId", "isSystem", "createdAt", "updatedAt")
       SELECT 'FINANCE', 'Finance', NULL, false, :now, :now
       WHERE NOT EXISTS (SELECT 1 FROM "Roles" WHERE name = 'FINANCE' AND "companyId" IS NULL)`,
      { replacements: { now } }
    );

    // Grant permission baru ke role existing sesuai defaults, dan seluruh
    // default FINANCE ke role FINANCE.
    const newKeys = ['hris.salary.manage'];
    const roles = await queryInterface.sequelize.query(
      `SELECT id, name FROM "Roles"`,
      { type: queryInterface.sequelize.QueryTypes.SELECT }
    );
    for (const role of roles) {
      const defaults = DEFAULT_PERMISSIONS[role.name] ?? [];
      const keysToGrant = role.name === 'FINANCE' ? defaults : newKeys.filter(k => defaults.includes(k));
      for (const key of keysToGrant) {
        await queryInterface.sequelize.query(
          `INSERT INTO "RolePermissions" ("roleId", "permissionKey", "createdAt", "updatedAt")
           VALUES (:roleId, :key, :now, :now)
           ON CONFLICT DO NOTHING`,
        { replacements: { roleId: role.id, key, now } }
        );
      }
    }
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(
      `DELETE FROM "RolePermissions" WHERE "permissionKey" = 'hris.salary.manage'`
    );
    await queryInterface.sequelize.query(
      `DELETE FROM "Permissions" WHERE key = 'hris.salary.manage'`
    );
    await queryInterface.sequelize.query(
      `DELETE FROM "RolePermissions" WHERE "roleId" IN (SELECT id FROM "Roles" WHERE name = 'FINANCE')`
    );
    await queryInterface.sequelize.query(
      `DELETE FROM "Roles" WHERE name = 'FINANCE'`
    );
  },
};
