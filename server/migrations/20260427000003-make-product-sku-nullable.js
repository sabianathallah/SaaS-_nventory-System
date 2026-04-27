'use strict';
// SKU, barcode, qrString dipindah ke ProductSKUs — jadikan nullable di Products
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn('Products', 'sku', {
      type: Sequelize.STRING,
      allowNull: true,
      unique: false,
    });
    await queryInterface.changeColumn('Products', 'barcode', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.changeColumn('Products', 'qrString', {
      type: Sequelize.STRING,
      allowNull: true,
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      UPDATE "Products"
      SET "sku" = COALESCE("sku", 'ROLLBACK-SKU-' || "id"::text)
      WHERE "sku" IS NULL
    `)

    await queryInterface.changeColumn('Products', 'sku', {
      type: Sequelize.STRING,
      allowNull: false,
    });
  }
};
