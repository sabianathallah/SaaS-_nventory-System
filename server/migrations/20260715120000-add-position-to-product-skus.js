'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('ProductSKUs', 'position', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
    });

    // Backfill: urutkan per produk mengikuti posisi variant option (lalu createdAt),
    // supaya urutan awal tabel SKU langsung konsisten dengan urutan chip variant.
    await queryInterface.sequelize.query(`
      WITH ranked AS (
        SELECT s.id,
               ROW_NUMBER() OVER (
                 PARTITION BY s."ProductId"
                 ORDER BY COALESCE(MIN(o.position), 999999), s."createdAt", s.id
               ) - 1 AS rn
        FROM "ProductSKUs" s
        LEFT JOIN "ProductSKUVariantOptions" svo ON svo."ProductSKUId" = s.id
        LEFT JOIN "ProductVariantOptions" o ON o.id = svo."ProductVariantOptionId"
        GROUP BY s.id
      )
      UPDATE "ProductSKUs" p SET position = ranked.rn
      FROM ranked WHERE ranked.id = p.id
    `);
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('ProductSKUs', 'position');
  },
};
