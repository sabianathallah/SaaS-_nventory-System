'use strict';
const { ALL_PERMISSIONS } = require('../helpers/permissions');

// Modul Tugas sebelumnya terbuka untuk semua user. Sekarang pakai izin tasks.view:
// semua role yang ada tetap dapat, KECUALI role kasir (isinya hanya izin POS + presensi HRIS).
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
      const cashierOnly = role.keys.some(k => k.startsWith('pos.')) && role.keys.every(k => k.startsWith('pos.') || k === 'hris.view');
      if (cashierOnly) continue;
      await queryInterface.sequelize.query(
        `INSERT INTO "RolePermissions" ("roleId", "permissionKey", "createdAt", "updatedAt")
         VALUES (:roleId, 'tasks.view', :now, :now)
         ON CONFLICT DO NOTHING`,
        { replacements: { roleId: role.id, now } }
      );
    }
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`DELETE FROM "RolePermissions" WHERE "permissionKey" = 'tasks.view'`);
    await queryInterface.sequelize.query(`DELETE FROM "Permissions" WHERE key = 'tasks.view'`);
  },
};
