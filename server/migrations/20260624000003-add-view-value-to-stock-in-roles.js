'use strict';

// Add inventory.view_value to every role that has any stock.in.* permission
// but does not yet have inventory.view_value or inventory.manage.

module.exports = {
  async up(queryInterface, Sequelize) {
    const now = new Date();

    const roles = await queryInterface.sequelize.query(
      `SELECT DISTINCT r.id, r."companyId"
       FROM "Roles" r
       JOIN "RolePermissions" rp ON rp."roleId" = r.id
       WHERE rp."permissionKey" LIKE 'stock.in%'
         AND r.id NOT IN (
           SELECT "roleId" FROM "RolePermissions"
           WHERE "permissionKey" IN ('inventory.view_value', 'inventory.manage')
         )`,
      { type: Sequelize.QueryTypes.SELECT }
    );

    for (const role of roles) {
      await queryInterface.sequelize.query(
        `INSERT INTO "RolePermissions" ("roleId", "permissionKey", "companyId", "createdAt", "updatedAt")
         VALUES (:roleId, 'inventory.view_value', :companyId, :now, :now)
         ON CONFLICT DO NOTHING`,
        { replacements: { roleId: role.id, companyId: role.companyId, now } }
      );
    }
  },

  async down(queryInterface, Sequelize) {
    // Remove only the permissions added by this migration:
    // roles that have stock.in.* AND inventory.view_value but NOT inventory.manage
    await queryInterface.sequelize.query(
      `DELETE FROM "RolePermissions"
       WHERE "permissionKey" = 'inventory.view_value'
         AND "roleId" IN (
           SELECT DISTINCT r.id FROM "Roles" r
           JOIN "RolePermissions" rp ON rp."roleId" = r.id
           WHERE rp."permissionKey" LIKE 'stock.in%'
         )
         AND "roleId" NOT IN (
           SELECT "roleId" FROM "RolePermissions" WHERE "permissionKey" = 'inventory.manage'
         )`
    );
  },
};
