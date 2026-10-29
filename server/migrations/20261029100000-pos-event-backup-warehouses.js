'use strict';
// POS: gudang cadangan event (mis. gudang sewa & truck) — stoknya ditampilkan di kasir
// supaya barang yang habis di booth tetap bisa dijual sebagai "ambil nanti".
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('PosEvents', 'backupWarehouseIds', { type: Sequelize.JSONB, allowNull: true });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('PosEvents', 'backupWarehouseIds');
  },
};
