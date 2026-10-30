'use strict';
const { ALL_PERMISSIONS } = require('../helpers/permissions');

// SOP & Handbook sebelumnya terbuka untuk semua user. Sekarang punya izin sendiri:
// semua role yang ada tetap dapat (tidak ada yang tiba-tiba terkunci), KECUALI role kasir
// (role yang isinya hanya izin POS, mis. KASIR / CASHIER) — role itu justru diberi presensi HRIS.
const NEW_KEYS = ['sop.view', 'handbook.view'];

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

    const roles = await queryInterface.sequelize.query(
      `SELECT r.id, COALESCE(array_agg(rp."permissionKey") FILTER (WHERE rp."permissionKey" IS NOT NULL), '{}') AS keys
       FROM "Roles" r LEFT JOIN "RolePermissions" rp ON rp."roleId" = r.id
       GROUP BY r.id`,
      { type: queryInterface.sequelize.QueryTypes.SELECT }
    );
    for (const role of roles) {
      const cashierOnly = role.keys.length > 0 && role.keys.every(k => k.startsWith('pos.'));
      for (const key of cashierOnly ? ['hris.view'] : NEW_KEYS) {
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
      `DELETE FROM "RolePermissions" WHERE "permissionKey" IN (:keys)`, { replacements: { keys: NEW_KEYS } }
    );
    await queryInterface.sequelize.query(
      `DELETE FROM "Permissions" WHERE key IN (:keys)`, { replacements: { keys: NEW_KEYS } }
    );
  },
};
