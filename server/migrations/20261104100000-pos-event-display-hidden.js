'use strict';
// POS: produk yang fotonya tidak ikut tampil di slideshow sambutan layar pelanggan (tetap bisa dijual).
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('PosEvents', 'displayHiddenProductIds', { type: Sequelize.JSONB, allowNull: true });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('PosEvents', 'displayHiddenProductIds');
  },
};
