'use strict';

module.exports = {
  async up(queryInterface) {
    const now = new Date();

    // Upsert STAFF role (companyId=null, not a system role)
    await queryInterface.sequelize.query(
      `INSERT INTO "Roles" (name, "displayName", "companyId", "isSystem", "createdAt", "updatedAt")
       VALUES ('STAFF', 'Staff', NULL, false, :now, :now)
       ON CONFLICT (name, "companyId") DO UPDATE SET "displayName" = 'Staff', "updatedAt" = :now`,
      { replacements: { now } }
    );

    const [rows] = await queryInterface.sequelize.query(
      `SELECT id FROM "Roles" WHERE name = 'STAFF' AND "companyId" IS NULL LIMIT 1`
    );
    const staffId = rows[0]?.id;
    if (!staffId) return;

    // Clear existing permissions for STAFF and set exactly inventory.view
    await queryInterface.sequelize.query(
      `DELETE FROM "RolePermissions" WHERE "roleId" = :staffId`,
      { replacements: { staffId } }
    );
    await queryInterface.sequelize.query(
      `INSERT INTO "RolePermissions" ("roleId", "permissionKey", "createdAt", "updatedAt")
       VALUES (:staffId, 'inventory.view', :now, :now)`,
      { replacements: { staffId, now } }
    );
  },

  async down(queryInterface) {
    const [rows] = await queryInterface.sequelize.query(
      `SELECT id FROM "Roles" WHERE name = 'STAFF' AND "companyId" IS NULL LIMIT 1`
    );
    const staffId = rows[0]?.id;
    if (!staffId) return;
    await queryInterface.sequelize.query(
      `DELETE FROM "RolePermissions" WHERE "roleId" = :staffId`,
      { replacements: { staffId } }
    );
  },
};
