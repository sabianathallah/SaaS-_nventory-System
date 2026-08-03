'use strict';
const { ALL_PERMISSIONS, DEFAULT_PERMISSIONS } = require('../helpers/permissions');

const NEW_KEYS = ['dashboard.view_stock', 'dashboard.view_value', 'dashboard.view_analytics', 'dashboard.view_movements'];

module.exports = {
  async up(queryInterface, Sequelize) {
    const newPerms = ALL_PERMISSIONS.filter(p => NEW_KEYS.includes(p.key));
    const now = new Date();

    // Insert new Permission rows (ignore if already exists)
    for (const p of newPerms) {
      await queryInterface.sequelize.query(
        `INSERT INTO "Permissions" (key, label, "group", "createdAt", "updatedAt")
         VALUES (:key, :label, :group, :now, :now)
         ON CONFLICT (key) DO NOTHING`,
        { replacements: { key: p.key, label: p.label, group: p.group, now } }
      );
    }

    // For each role in DEFAULT_PERMISSIONS, grant the new keys it should have
    const roles = await queryInterface.sequelize.query(
      `SELECT id, name FROM "Roles"`,
      { type: queryInterface.sequelize.QueryTypes.SELECT }
    );

    for (const role of roles) {
      const allowed = DEFAULT_PERMISSIONS[role.name] ?? [];
      const keysToAdd = NEW_KEYS.filter(k => allowed.includes(k));
      for (const key of keysToAdd) {
        await queryInterface.sequelize.query(
          `INSERT INTO "RolePermissions" ("roleId", "permissionKey", "createdAt", "updatedAt")
           VALUES (:roleId, :key, :now, :now)
           ON CONFLICT ("roleId", "permissionKey") DO NOTHING`,
          { replacements: { roleId: role.id, key, now } }
        );
      }
    }
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(
      `DELETE FROM "RolePermissions" WHERE "permissionKey" = ANY(ARRAY[:keys])`,
      { replacements: { keys: NEW_KEYS } }
    );
    await queryInterface.sequelize.query(
      `DELETE FROM "Permissions" WHERE key = ANY(ARRAY[:keys])`,
      { replacements: { keys: NEW_KEYS } }
    );
  },
};
