'use strict';

module.exports = {
  async up(queryInterface) {
    // Set requestorId = 5 (Azzahra Adelia) for all requests currently owned by SUPER_ADMIN (id=1)
    await queryInterface.sequelize.query(`
      UPDATE "Requests"
      SET "requestorId" = 5, "updatedAt" = NOW()
      WHERE "requestorId" = 1 AND "companyId" = 2
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      UPDATE "Requests"
      SET "requestorId" = 1, "updatedAt" = NOW()
      WHERE "requestorId" = 5 AND "companyId" = 2
    `);
  },
};
