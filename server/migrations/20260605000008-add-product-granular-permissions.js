'use strict';
const { ALL_PERMISSIONS, DEFAULT_PERMISSIONS } = require('../helpers/permissions');

module.exports = {
  async up(queryInterface) {
    const Q   = queryInterface.sequelize.QueryTypes.SELECT;
    const now = new Date();

    // Upsert all permissions (adds new, updates labels/groups)
    for (const p of ALL_PERMISSIONS) {
      await queryInterface.sequelize.query(
        `INSERT INTO "Permissions" (key, label, "group", "createdAt", "updatedAt")
         VALUES (:key, :label, :group, :now, :now)
         ON CONFLICT (key) DO UPDATE SET label = :label, "group" = :group, "updatedAt" = :now`,
        { replacements: { key: p.key, label: p.label, group: p.group, now } }
      );
    }

    // Sync system-role RolePermissions
    const allKeys = ALL_PERMISSIONS.map(p => p.key);
    for (const [roleName, perms] of Object.entries(DEFAULT_PERMISSIONS)) {
      const roleRows = await queryInterface.sequelize.query(
        `SELECT id FROM "Roles" WHERE name = :name AND "companyId" IS NULL LIMIT 1`,
        { type: Q, replacements: { name: roleName } }
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

      const toRemove = allKeys.filter(k => !perms.includes(k));
      if (toRemove.length) {
        await queryInterface.sequelize.query(
          `DELETE FROM "RolePermissions"
           WHERE "roleId" = :roleId AND "permissionKey" IN (:toRemove)`,
          { replacements: { roleId, toRemove } }
        );
      }
    }
  },

  async down() {},
};
