'use strict';

module.exports = {
  async up(queryInterface) {
    // Rebuild Stocks table from SkuWarehouseStocks (per-SKU source of truth)
    await queryInterface.sequelize.query(`
      INSERT INTO "Stocks" ("ProductId", "WarehouseId", "quantity", "companyId", "createdAt", "updatedAt")
      SELECT
        ps."ProductId",
        sws."WarehouseId",
        SUM(sws.qty),
        sws."companyId",
        NOW(),
        NOW()
      FROM "SkuWarehouseStocks" sws
      JOIN "ProductSKUs" ps ON ps.id = sws."ProductSKUId"
      GROUP BY ps."ProductId", sws."WarehouseId", sws."companyId"
      ON CONFLICT ("ProductId", "WarehouseId")
      DO UPDATE SET quantity = EXCLUDED.quantity, "updatedAt" = NOW()
    `);
  },

  async down() {},
};
