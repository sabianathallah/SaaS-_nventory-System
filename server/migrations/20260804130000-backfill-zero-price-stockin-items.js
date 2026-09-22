'use strict';

// Some Stock_In_Items were created with price = 0 because the item was added
// before its ProductSKU had a price set yet (e.g. restock batches entered
// ahead of pricing). This left "Total Nilai" showing Rp 0 on the Stock In
// list/detail pages even after the SKU's price was filled in later.
//
// Backfills price on any Stock_In_Item still at 0 using its SKU's current
// price, system-wide (not scoped to a specific note like the earlier
// 20260624000004 migration).
//
// Not reversible: once price is backfilled it's no longer 0, so `down` can't
// re-select the same rows to revert them.

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(
      `UPDATE "Stock_In_Items" sii
       SET price = ps.price, "updatedAt" = NOW()
       FROM "ProductSKUs" ps
       WHERE sii."ProductSKUId" = ps.id
         AND sii.price = 0
         AND ps.price > 0`
    );
  },

  async down() {
    // Intentionally a no-op — see comment above.
  },
};
