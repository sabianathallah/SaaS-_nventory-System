'use strict';

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const Q = queryInterface.sequelize.QueryTypes.SELECT;

    // Find or create STAFF role
    let rows = await queryInterface.sequelize.query(
      `SELECT id FROM "Roles" WHERE name = 'STAFF' AND "companyId" IS NULL LIMIT 1`,
      { type: Q }
    );

    let staffId;
    if (rows.length > 0) {
      staffId = rows[0].id;
      await queryInterface.sequelize.query(
        `UPDATE "Roles" SET "displayName" = 'Staff', "updatedAt" = :now WHERE id = :id`,
        { replacements: { now, id: staffId } }
      );
    } else {
      await queryInterface.sequelize.query(
        `INSERT INTO "Roles" (name, "displayName", "companyId", "isSystem", "createdAt", "updatedAt")
         VALUES ('STAFF', 'Staff', NULL, false, :now, :now)`,
        { replacements: { now } }
      );
      rows = await queryInterface.sequelize.query(
        `SELECT id FROM "Roles" WHERE name = 'STAFF' AND "companyId" IS NULL LIMIT 1`,
        { type: Q }
      );
      staffId = rows[0]?.id;
    }

    if (!staffId) return;

    // Set permissions to exactly: inventory.view only
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

  async down() {},
};
