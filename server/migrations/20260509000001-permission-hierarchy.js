'use strict';
const { ALL_PERMISSIONS, DEFAULT_PERMISSIONS } = require('../helpers/permissions');

module.exports = {
  async up(queryInterface) {
    const Q   = queryInterface.sequelize.QueryTypes.SELECT;
    const now = new Date();

    // ── 1. Upsert all permissions (adds new parent keys) ─────────────────────
    for (const p of ALL_PERMISSIONS) {
      await queryInterface.sequelize.query(
        `INSERT INTO "Permissions" (key, label, "group", "createdAt", "updatedAt")
         VALUES (:key, :label, :group, :now, :now)
         ON CONFLICT (key) DO UPDATE SET label = :label, "group" = :group, "updatedAt" = :now`,
        { replacements: { key: p.key, label: p.label, group: p.group, now } }
      );
    }

    // ── 2. For each system role, sync permissions to DEFAULT_PERMISSIONS ──────
    for (const [roleName, perms] of Object.entries(DEFAULT_PERMISSIONS)) {
      const roleRows = await queryInterface.sequelize.query(
        `SELECT id FROM "Roles" WHERE name = :name AND "companyId" IS NULL LIMIT 1`,
        { type: Q, replacements: { name: roleName } }
      );
      if (!roleRows.length) continue;
      const roleId = roleRows[0].id;

      // Add new permission keys that don't exist yet for this role
      for (const key of perms) {
        await queryInterface.sequelize.query(
          `INSERT INTO "RolePermissions" ("roleId", "permissionKey", "createdAt", "updatedAt")
           VALUES (:roleId, :key, :now, :now)
           ON CONFLICT ("roleId", "permissionKey") DO NOTHING`,
          { replacements: { roleId, key, now } }
        );
      }

      // Remove permissions that are no longer in the default list for this role
      // Only remove keys that exist in ALL_PERMISSIONS (don't touch custom keys)
      const allKeys = ALL_PERMISSIONS.map(p => p.key);
      const toRemove = allKeys.filter(k => !perms.includes(k));
      if (toRemove.length) {
        await queryInterface.sequelize.query(
          `DELETE FROM "RolePermissions"
           WHERE "roleId" = :roleId AND "permissionKey" = ANY(:toRemove)`,
          { replacements: { roleId, toRemove } }
        );
      }
    }
  },

  async down() {},
};
