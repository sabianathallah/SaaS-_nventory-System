'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Migrate existing ADMIN users → COMPANY_ADMIN
    await queryInterface.sequelize.query(`
      UPDATE "Users" SET role = 'COMPANY_ADMIN' WHERE role = 'ADMIN'
    `);

    // Remove the ADMIN role row from Roles table (if seeded)
    await queryInterface.sequelize.query(`
      DELETE FROM "Roles" WHERE name = 'ADMIN'
    `);
  },

  async down(queryInterface, Sequelize) {
    // Restore ADMIN role row
    await queryInterface.sequelize.query(`
      INSERT INTO "Roles" (name, "displayName", "isSystem", "companyId", "createdAt", "updatedAt")
      VALUES ('ADMIN', 'Admin', true, NULL, NOW(), NOW())
      ON CONFLICT DO NOTHING
    `);
  },
};
