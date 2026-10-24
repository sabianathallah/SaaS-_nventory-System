'use strict';
// POS: tukar barang (transaksi baru yang mengembalikan barang dari transaksi asal) + batas beli per orang di event.
module.exports = {
  async up(queryInterface, Sequelize) {
    // { qty, productIds: [] (kosong = semua produk), perPhone }
    await queryInterface.addColumn('PosEvents', 'purchaseLimit', { type: Sequelize.JSONB, allowNull: true });
    await queryInterface.addColumn('PosOrders', 'exchangeOfOrderId', {
      type: Sequelize.INTEGER, allowNull: true, references: { model: 'PosOrders', key: 'id' }, onDelete: 'SET NULL', onUpdate: 'CASCADE',
    });
    // nilai barang yang dikembalikan; total = subtotal - diskon - returnTotal (boleh negatif = uang dikembalikan)
    await queryInterface.addColumn('PosOrders', 'returnTotal', { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 });
    await queryInterface.addIndex('PosOrders', ['exchangeOfOrderId']);
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('PosOrders', ['exchangeOfOrderId']);
    await queryInterface.removeColumn('PosOrders', 'returnTotal');
    await queryInterface.removeColumn('PosOrders', 'exchangeOfOrderId');
    await queryInterface.removeColumn('PosEvents', 'purchaseLimit');
  },
};
