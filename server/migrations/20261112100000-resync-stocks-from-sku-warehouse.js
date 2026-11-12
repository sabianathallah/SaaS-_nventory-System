'use strict';

// One-time resync of the legacy product-level "Stocks" table from SkuWarehouseStocks.
// Hand-kept deltas clamped at 0, so warehouses that went minus (POS booth USS 2026)
// kept phantom stock. From now on helpers/skuStock.js keeps Stocks derived.
// Products without SKUs are untouched (Stocks is still their only ledger).
module.exports = {
  async up(queryInterface) {
    const sums = `SELECT ps."ProductId", sws."WarehouseId", SUM(sws.qty)::int AS qty, MAX(sws."companyId") AS "companyId"
                    FROM "SkuWarehouseStocks" sws JOIN "ProductSKUs" ps ON ps.id = sws."ProductSKUId"
                   GROUP BY ps."ProductId", sws."WarehouseId"`;
    await queryInterface.sequelize.query(`
      UPDATE "Stocks" s SET quantity = x.qty, "updatedAt" = NOW()
        FROM (${sums}) x
       WHERE x."ProductId" = s."ProductId" AND x."WarehouseId" = s."WarehouseId" AND s.quantity <> x.qty
    `);
    await queryInterface.sequelize.query(`
      INSERT INTO "Stocks" ("ProductId", "WarehouseId", "quantity", "companyId", "createdAt", "updatedAt")
      SELECT x."ProductId", x."WarehouseId", x.qty, x."companyId", NOW(), NOW()
        FROM (${sums}) x
       WHERE NOT EXISTS (SELECT 1 FROM "Stocks" s WHERE s."ProductId" = x."ProductId" AND s."WarehouseId" = x."WarehouseId")
    `);
    // Stocks rows of SKU products in a warehouse with no SKU stock rows at all → 0
    await queryInterface.sequelize.query(`
      UPDATE "Stocks" s SET quantity = 0, "updatedAt" = NOW()
       WHERE s.quantity <> 0
         AND EXISTS (SELECT 1 FROM "ProductSKUs" ps WHERE ps."ProductId" = s."ProductId")
         AND NOT EXISTS (
           SELECT 1 FROM "SkuWarehouseStocks" sws JOIN "ProductSKUs" ps ON ps.id = sws."ProductSKUId"
            WHERE ps."ProductId" = s."ProductId" AND sws."WarehouseId" = s."WarehouseId")
    `);
  },

  async down() {},
};
