'use strict';

// Update price on Stock_In_Items that belong to the INITIAL migration header
// (note = 'Stok awal (migrasi dari input manual)') using each SKU's current price.

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(
      `UPDATE "Stock_In_Items" sii
       SET price = ps.price, "updatedAt" = NOW()
       FROM "ProductSKUs" ps
       WHERE sii."ProductSKUId" = ps.id
         AND sii."StockInHeaderId" IN (
           SELECT id FROM "Stock_In_Headers"
           WHERE note = 'Stok awal (migrasi dari input manual)'
         )
         AND ps.price > 0`
    );
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(
      `UPDATE "Stock_In_Items" sii
       SET price = 0, "updatedAt" = NOW()
       WHERE sii."StockInHeaderId" IN (
         SELECT id FROM "Stock_In_Headers"
         WHERE note = 'Stok awal (migrasi dari input manual)'
       )`
    );
  },
};
