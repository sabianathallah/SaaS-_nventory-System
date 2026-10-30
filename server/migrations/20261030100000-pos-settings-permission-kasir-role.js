'use strict';
const { ALL_PERMISSIONS, DEFAULT_PERMISSIONS } = require('../helpers/permissions');

module.exports = {
  async up(queryInterface) {
    const now = new Date();

    // Upsert katalog permission (termasuk pos.settings yang baru)
    for (const p of ALL_PERMISSIONS) {
      await queryInterface.sequelize.query(
        `INSERT INTO "Permissions" (key, label, "group", "createdAt", "updatedAt")
         VALUES (:key, :label, :group, :now, :now)
         ON CONFLICT (key) DO UPDATE SET label = :label, "group" = :group, "updatedAt" = :now`,
        { replacements: { key: p.key, label: p.label, group: p.group, now } }
      );
    }

    // Role KASIR (global, bukan per-company)
    await queryInterface.sequelize.query(
      `INSERT INTO "Roles" (name, "displayName", "companyId", "isSystem", "createdAt", "updatedAt")
       SELECT 'KASIR', 'Kasir', NULL, false, :now, :now
       WHERE NOT EXISTS (SELECT 1 FROM "Roles" WHERE name = 'KASIR' AND "companyId" IS NULL)`,
      { replacements: { now } }
    );

    // Role yang sudah punya pos.manage tetap bisa membuka pengaturan; KASIR dapat default-nya.
    const roles = await queryInterface.sequelize.query(
      `SELECT r.id, r.name, EXISTS (SELECT 1 FROM "RolePermissions" rp WHERE rp."roleId" = r.id AND rp."permissionKey" = 'pos.manage') AS "hasPosManage"
       FROM "Roles" r`,
      { type: queryInterface.sequelize.QueryTypes.SELECT }
    );
    for (const role of roles) {
      const keys = role.name === 'KASIR' ? DEFAULT_PERMISSIONS.KASIR : role.hasPosManage ? ['pos.settings'] : [];
      for (const key of keys) {
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
      `DELETE FROM "RolePermissions" WHERE "permissionKey" = 'pos.settings'`
    );
    await queryInterface.sequelize.query(
      `DELETE FROM "Permissions" WHERE key = 'pos.settings'`
    );
    await queryInterface.sequelize.query(
      `DELETE FROM "RolePermissions" WHERE "roleId" IN (SELECT id FROM "Roles" WHERE name = 'KASIR' AND "companyId" IS NULL)`
    );
    await queryInterface.sequelize.query(
      `DELETE FROM "Roles" WHERE name = 'KASIR' AND "companyId" IS NULL`
    );
  },
};
