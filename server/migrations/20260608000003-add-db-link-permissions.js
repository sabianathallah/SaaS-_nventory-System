'use strict';
const { ALL_PERMISSIONS, DEFAULT_PERMISSIONS } = require('../helpers/permissions');

module.exports = {
  async up(queryInterface) {
    const newKeys = ['db_link.manage', 'db_link.view', 'db_link.add_link'];

    // Insert into Permissions table
    const now = new Date();
    const newPerms = ALL_PERMISSIONS
      .filter(p => newKeys.includes(p.key))
      .map(p => ({
        key:       p.key,
        label:     p.label,
        group:     p.group,
        createdAt: now,
        updatedAt: now,
      }));

    if (newPerms.length) {
      await queryInterface.bulkInsert('Permissions', newPerms, { ignoreDuplicates: true });
    }

    // Grant to existing roles
    const roles = await queryInterface.sequelize.query(
      `SELECT id, name FROM "Roles"`,
      { type: queryInterface.sequelize.QueryTypes.SELECT }
    );

    const inserts = [];
    for (const role of roles) {
      const granted = DEFAULT_PERMISSIONS[role.name] ?? [];
      for (const key of newKeys) {
        if (granted.includes(key)) {
          inserts.push({ roleId: role.id, permissionKey: key, createdAt: now, updatedAt: now });
        }
      }
    }

    if (inserts.length) {
      await queryInterface.bulkInsert('RolePermissions', inserts, { ignoreDuplicates: true });
    }
  },

  async down(queryInterface) {
    const newKeys = ['db_link.manage', 'db_link.view', 'db_link.add_link'];
    await queryInterface.bulkDelete('RolePermissions', { permissionKey: newKeys });
    await queryInterface.bulkDelete('Permissions',     { key: newKeys });
  },
};
