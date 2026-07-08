'use strict';
const { ALL_PERMISSIONS, DEFAULT_PERMISSIONS } = require('../helpers/permissions');

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    for (const p of ALL_PERMISSIONS) {
      await queryInterface.sequelize.query(
        `INSERT INTO "Permissions" (key, label, "group", "createdAt", "updatedAt")
         VALUES (:key, :label, :group, :now, :now)
         ON CONFLICT (key) DO UPDATE SET label = :label, "group" = :group, "updatedAt" = :now`,
        { replacements: { key: p.key, label: p.label, group: p.group, now } }
      );
    }

    const newKeys = ['hris.wfa.review'];
    const roles = await queryInterface.sequelize.query(
      `SELECT id, name FROM "Roles"`,
      { type: queryInterface.sequelize.QueryTypes.SELECT }
    );
    for (const role of roles) {
      const defaults = DEFAULT_PERMISSIONS[role.name] ?? [];
      for (const key of newKeys) {
        if (!defaults.includes(key)) continue;
        await queryInterface.sequelize.query(
          `INSERT INTO "RolePermissions" ("roleId", "permissionKey", "createdAt", "updatedAt")
           VALUES (:roleId, :key, :now, :now)
           ON CONFLICT DO NOTHING`,
          { replacements: { roleId: role.id, key, now } }
        );
      }
    }

    // Role apa pun yang saat ini sudah punya hris.leave.review kemungkinan
    // juga bertugas approve WFA (karena sebelumnya reuse permission yang sama)
    // — kasih hris.wfa.review juga biar nggak ada yang kehilangan akses.
    const rolesWithLeaveReview = await queryInterface.sequelize.query(
      `SELECT DISTINCT "roleId" FROM "RolePermissions" WHERE "permissionKey" = 'hris.leave.review'`,
      { type: queryInterface.sequelize.QueryTypes.SELECT }
    );
    for (const row of rolesWithLeaveReview) {
      await queryInterface.sequelize.query(
        `INSERT INTO "RolePermissions" ("roleId", "permissionKey", "createdAt", "updatedAt")
         VALUES (:roleId, 'hris.wfa.review', :now, :now)
         ON CONFLICT DO NOTHING`,
        { replacements: { roleId: row.roleId, now } }
      );
    }
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(
      `DELETE FROM "RolePermissions" WHERE "permissionKey" = 'hris.wfa.review'`
    );
    await queryInterface.sequelize.query(
      `DELETE FROM "Permissions" WHERE key = 'hris.wfa.review'`
    );
  },
};
