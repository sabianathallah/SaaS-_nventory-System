'use strict';
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX "late_excuse_requests_active_unique"
      ON "LateExcuseRequests" ("userId", "date")
      WHERE status IN ('PENDING', 'APPROVED')
    `);
  },
  async down(queryInterface) {
    await queryInterface.sequelize.query(`DROP INDEX IF EXISTS "late_excuse_requests_active_unique"`);
  },
};
