'use strict';
// POS: harga promo per artikel (produk) untuk satu event — [{ productId, type: 'PERCENT' | 'PRICE', value }].
// Harga master SKU tidak diubah; kasir memakai harga promo ini sebagai harga awal.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('PosEvents', 'priceRules', { type: Sequelize.JSONB, allowNull: true });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('PosEvents', 'priceRules');
  },
};
