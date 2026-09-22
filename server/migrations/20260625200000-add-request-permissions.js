'use strict';

const NEW_PERMS = [
  { key: 'request.manage',  label: 'Akses Penuh Pengajuan',  group: 'Pengajuan' },
  { key: 'request.view',    label: 'Lihat Semua Pengajuan',  group: 'Pengajuan' },
  { key: 'request.create',  label: 'Buat Pengajuan',         group: 'Pengajuan' },
  { key: 'request.process', label: 'Proses Pengajuan',       group: 'Pengajuan' },
];

// role name → permission keys to assign
const ROLE_GRANTS = {
  SUPER_ADMIN:        ['request.manage', 'request.view', 'request.create', 'request.process'],
  COMPANY_ADMIN:      ['request.manage', 'request.view', 'request.create', 'request.process'],
  OPERASIONAL:        ['request.manage', 'request.view', 'request.create', 'request.process'],
  CEO:                ['request.view'],
  MARKETING:          ['request.view', 'request.create'],
  STAFF:              ['request.create'],
  PRODUKSI:           ['request.create'],
  PRODUK_DEVELOPMENT: ['request.create'],
};

module.exports = {
  async up(queryInterface, Sequelize) {
    const now = new Date();

    // 1. Insert permissions (skip if already exists)
    for (const p of NEW_PERMS) {
      const [existing] = await queryInterface.sequelize.query(
        `SELECT id FROM "Permissions" WHERE key = :key LIMIT 1`,
        { replacements: { key: p.key }, type: Sequelize.QueryTypes.SELECT }
      );
      if (!existing) {
        await queryInterface.sequelize.query(
          `INSERT INTO "Permissions" (key, label, "group", "createdAt", "updatedAt") VALUES (:key, :label, :group, :now, :now)`,
          { replacements: { ...p, now } }
        );
      }
    }

    // 2. Assign to roles
    for (const [roleName, keys] of Object.entries(ROLE_GRANTS)) {
      const [role] = await queryInterface.sequelize.query(
        `SELECT id FROM "Roles" WHERE name = :name LIMIT 1`,
        { replacements: { name: roleName }, type: Sequelize.QueryTypes.SELECT }
      );
      if (!role) continue;

      for (const key of keys) {
        const [exists] = await queryInterface.sequelize.query(
          `SELECT id FROM "RolePermissions" WHERE "roleId" = :roleId AND "permissionKey" = :key LIMIT 1`,
          { replacements: { roleId: role.id, key }, type: Sequelize.QueryTypes.SELECT }
        );
        if (!exists) {
          await queryInterface.sequelize.query(
            `INSERT INTO "RolePermissions" ("roleId", "permissionKey", "createdAt", "updatedAt") VALUES (:roleId, :key, :now, :now)`,
            { replacements: { roleId: role.id, key, now } }
          );
        }
      }
    }
  },

  async down(queryInterface) {
    const keys = ['request.manage', 'request.view', 'request.create', 'request.process'];
    for (const key of keys) {
      await queryInterface.sequelize.query(
        `DELETE FROM "RolePermissions" WHERE "permissionKey" = :key`,
        { replacements: { key } }
      );
      await queryInterface.sequelize.query(
        `DELETE FROM "Permissions" WHERE key = :key`,
        { replacements: { key } }
      );
    }
  },
};
