'use strict';

/**
 * Previous migration's queryInterface.changeColumn() with a `references` clause
 * did not actually drop NOT NULL on Stock_In_Headers.SupplierId under Postgres.
 * Force it via raw ALTER TABLE.
 */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(
      'ALTER TABLE "Stock_In_Headers" ALTER COLUMN "SupplierId" DROP NOT NULL;'
    );
  },
  async down(queryInterface) {
    await queryInterface.sequelize.query(
      'ALTER TABLE "Stock_In_Headers" ALTER COLUMN "SupplierId" SET NOT NULL;'
    );
  },
};
