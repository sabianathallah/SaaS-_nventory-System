'use strict';

// Backfill source field on Stock_Movements that were created before source was set consistently.
// Safe mapping:
//   type='IN',         source IS NULL → 'STOCK_IN'   (INITIAL & TRANSFER already have source set)
//   type='OUT',        source IS NULL → 'STOCK_OUT'   (TRANSFER already has source set)
//   type='ADJUSTMENT', source IS NULL → 'OPNAME'

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      UPDATE "Stock_Movements"
      SET source = 'STOCK_IN', "updatedAt" = NOW()
      WHERE source IS NULL AND type = 'IN'
    `);
    await queryInterface.sequelize.query(`
      UPDATE "Stock_Movements"
      SET source = 'STOCK_OUT', "updatedAt" = NOW()
      WHERE source IS NULL AND type = 'OUT'
    `);
    await queryInterface.sequelize.query(`
      UPDATE "Stock_Movements"
      SET source = 'OPNAME', "updatedAt" = NOW()
      WHERE source IS NULL AND type = 'ADJUSTMENT'
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      UPDATE "Stock_Movements"
      SET source = NULL, "updatedAt" = NOW()
      WHERE source IN ('STOCK_IN', 'STOCK_OUT', 'OPNAME')
    `);
  },
};
