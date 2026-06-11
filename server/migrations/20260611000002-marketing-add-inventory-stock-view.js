'use strict';

const ADD_PERMS = ['inventory.view', 'stock.view'];

module.exports = {
  async up(queryInterface) {
    const now = new Date();

    // Find all MARKETING and PRODUK_DEVELOPMENT roles
    const [roles] = await queryInterface.sequelize.query(
      `SELECT id FROM "Roles" WHERE name IN ('MARKETING', 'PRODUK_DEVELOPMENT')`
    );

    for (const role of roles) {
      for (const key of ADD_PERMS) {
        await queryInterface.sequelize.query(
          `INSERT INTO "RolePermissions" ("roleId", "permissionKey", "createdAt", "updatedAt")
           SELECT :roleId, :key, :now, :now
           WHERE NOT EXISTS (
             SELECT 1 FROM "RolePermissions" WHERE "roleId" = :roleId AND "permissionKey" = :key
           )`,
          { replacements: { roleId: role.id, key, now } }
        );
      }
    }
  },

  async down(queryInterface) {
    const [roles] = await queryInterface.sequelize.query(
      `SELECT id FROM "Roles" WHERE name IN ('MARKETING', 'PRODUK_DEVELOPMENT')`
    );
    for (const role of roles) {
      await queryInterface.sequelize.query(
        `DELETE FROM "RolePermissions" WHERE "roleId" = :roleId AND "permissionKey" IN ('inventory.view', 'stock.view')`,
        { replacements: { roleId: role.id } }
      );
    }
  },
};
