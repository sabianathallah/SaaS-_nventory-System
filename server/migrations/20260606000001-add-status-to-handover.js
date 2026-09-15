'use strict';

module.exports = {
  async up(queryInterface) {
    // Use raw SQL to avoid PostgreSQL ENUM type issues across environments
    await queryInterface.sequelize.query(`
      ALTER TABLE "Handovers"
      ADD COLUMN IF NOT EXISTS "status" VARCHAR(10) NOT NULL DEFAULT 'OPEN';
    `);
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('Handovers', 'status');
  },
};
