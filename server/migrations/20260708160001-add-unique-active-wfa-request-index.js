'use strict';
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX "wfa_requests_active_unique"
      ON "WfaRequests" ("userId", "date")
      WHERE status IN ('PENDING', 'APPROVED')
    `);
  },
  async down(queryInterface) {
    await queryInterface.sequelize.query(`DROP INDEX IF EXISTS "wfa_requests_active_unique"`);
  },
};
