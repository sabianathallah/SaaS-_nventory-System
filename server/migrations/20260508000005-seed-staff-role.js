'use strict';

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const Q = queryInterface.sequelize.QueryTypes.SELECT;

    // Find existing STAFF role with companyId IS NULL
    const existing = await queryInterface.sequelize.query(
      `SELECT id FROM "Roles" WHERE name = 'STAFF' AND "companyId" IS NULL LIMIT 1`,
      { type: Q }
    );

    let staffId;
    if (existing.length > 0) {
      staffId = existing[0].id;
      // Update displayName
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
      const inserted = await queryInterface.sequelize.query(
        `SELECT id FROM "Roles" WHERE name = 'STAFF' AND "companyId" IS NULL LIMIT 1`,
        { type: Q }
      );
      staffId = inserted[0]?.id;
    }

    if (!staffId) return;

    // Reset permissions to exactly: inventory.view
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
    const Q = queryInterface.sequelize.QueryTypes.SELECT;
    const rows = await queryInterface.sequelize.query(
      `SELECT id FROM "Roles" WHERE name = 'STAFF' AND "companyId" IS NULL LIMIT 1`,
      { type: Q }
    );
    if (!rows.length) return;
    await queryInterface.sequelize.query(
      `DELETE FROM "RolePermissions" WHERE "roleId" = :id`,
      { replacements: { id: rows[0].id } }
    );
  },
};
