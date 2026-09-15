'use strict';

// Migrates existing ProductSKU.qty (entered manually, no warehouse context) to
// SkuWarehouseStocks with WarehouseId = 1 (GUDANG READY).
// Also creates one Stock_In_Header per company with type INITIAL and corresponding
// Stock_In_Items + Stock_Movements so there is a proper audit trail.

const GUDANG_READY_ID = 1;

module.exports = {
  async up(queryInterface, Sequelize) {
    const t = await queryInterface.sequelize.transaction();
    try {
      const now = new Date();

      // 1. Fetch all SKUs with qty > 0
      const skus = await queryInterface.sequelize.query(
        `SELECT id, "ProductId", qty, "companyId" FROM "ProductSKUs" WHERE qty > 0`,
        { type: Sequelize.QueryTypes.SELECT, transaction: t }
      );

      if (skus.length === 0) { await t.commit(); return; }

      // 2. Insert SkuWarehouseStocks rows (ignore duplicates in case re-run)
      for (const sku of skus) {
        await queryInterface.sequelize.query(
          `INSERT INTO "SkuWarehouseStocks" ("ProductSKUId", "WarehouseId", qty, "companyId", "createdAt", "updatedAt")
           VALUES (:skuId, :warehouseId, :qty, :companyId, :now, :now)
           ON CONFLICT ("ProductSKUId", "WarehouseId") DO NOTHING`,
          {
            replacements: { skuId: sku.id, warehouseId: GUDANG_READY_ID, qty: sku.qty, companyId: sku.companyId, now },
            transaction: t,
          }
        );
      }

      // 3. Create one INITIAL Stock_In_Header per company that has SKUs
      const companyIds = [...new Set(skus.map(s => s.companyId).filter(Boolean))];

      for (const cid of companyIds) {
        const companySKUs = skus.filter(s => s.companyId === cid);

        // Insert header
        const [headerRows] = await queryInterface.sequelize.query(
          `INSERT INTO "Stock_In_Headers" ("WarehouseId", date, note, "companyId", "createdAt", "updatedAt")
           VALUES (:warehouseId, :date, :note, :cid, :now, :now)
           RETURNING id`,
          {
            replacements: {
              warehouseId: GUDANG_READY_ID,
              date: now,
              note: 'Stok awal (migrasi dari input manual)',
              cid,
              now,
            },
            transaction: t,
          }
        );
        const headerId = headerRows[0].id;

        for (const sku of companySKUs) {
          // Insert item
          await queryInterface.sequelize.query(
            `INSERT INTO "Stock_In_Items" ("StockInHeaderId", "ProductSKUId", quantity, price, "companyId", "createdAt", "updatedAt")
             VALUES (:headerId, :skuId, :qty, 0, :cid, :now, :now)`,
            {
              replacements: { headerId, skuId: sku.id, qty: sku.qty, cid, now },
              transaction: t,
            }
          );

          // Insert Stock_Movement
          await queryInterface.sequelize.query(
            `INSERT INTO "Stock_Movements" ("ProductId", "ProductSKUId", "WarehouseId", type, quantity, "ReferenceId", source, note, date, "companyId", "createdAt", "updatedAt")
             VALUES (:productId, :skuId, :warehouseId, 'IN', :qty, :headerId, 'INITIAL', 'Stok awal (migrasi)', :date, :cid, :now, :now)`,
            {
              replacements: {
                productId: sku.ProductId,
                skuId: sku.id,
                warehouseId: GUDANG_READY_ID,
                qty: sku.qty,
                headerId,
                date: now,
                cid,
                now,
              },
              transaction: t,
            }
          );
        }
      }

      await t.commit();
    } catch (err) {
      await t.rollback();
      throw err;
    }
  },

  async down(queryInterface) {
    // Remove INITIAL migration records — SkuWarehouseStocks rows dropped with the table
    await queryInterface.sequelize.query(
      `DELETE FROM "Stock_In_Headers" WHERE note = 'Stok awal (migrasi dari input manual)'`
    );
  },
};
