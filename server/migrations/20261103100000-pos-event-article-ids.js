'use strict';
// POS: koleksi (Article) yang dijual di event — katalog kasir hanya berisi SKU dari koleksi ini.
// Kosong / null = semua produk.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('PosEvents', 'articleIds', { type: Sequelize.JSONB, allowNull: true });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('PosEvents', 'articleIds');
  },
};
