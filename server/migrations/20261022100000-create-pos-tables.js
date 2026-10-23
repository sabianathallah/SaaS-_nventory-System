'use strict';
// Kasir / POS untuk event pop up. Penjualan tetap mengurangi stok lewat Stock_Out_Header
// (tujuan Penjualan), tabel-tabel ini menyimpan data kasirnya: harga jual nyata, diskon, pembayaran, shift.
module.exports = {
  async up(queryInterface, Sequelize) {
    const ts = {
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    };
    const fk = (model, onDelete = 'SET NULL', allowNull = true) => ({
      type: Sequelize.INTEGER, allowNull, references: { model, key: 'id' }, onDelete, onUpdate: 'CASCADE',
    });

    await queryInterface.createTable('PosEvents', {
      id:          { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      companyId:   { type: Sequelize.INTEGER, allowNull: true },
      name:        { type: Sequelize.STRING(150), allowNull: false },
      location:    { type: Sequelize.STRING(200), allowNull: true },
      startDate:   { type: Sequelize.DATEONLY, allowNull: true },
      endDate:     { type: Sequelize.DATEONLY, allowNull: true },
      WarehouseId: fk('Warehouses', 'RESTRICT', false),
      ChannelId:   fk('Channels', 'RESTRICT', false),
      status:      { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'PREP' },
      receiptHeader: { type: Sequelize.TEXT, allowNull: true },
      receiptFooter: { type: Sequelize.TEXT, allowNull: true },
      createdBy:   fk('Users'),
      ...ts,
    });

    await queryInterface.createTable('PosShifts', {
      id:          { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      companyId:   { type: Sequelize.INTEGER, allowNull: true },
      eventId:     fk('PosEvents', 'CASCADE', false),
      cashierId:   fk('Users'),
      deviceName:  { type: Sequelize.STRING(60), allowNull: true },
      openedAt:    { type: Sequelize.DATE, allowNull: false },
      closedAt:    { type: Sequelize.DATE, allowNull: true },
      openingCash: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      countedCash: { type: Sequelize.INTEGER, allowNull: true },
      note:        { type: Sequelize.TEXT, allowNull: true },
      status:      { type: Sequelize.STRING(10), allowNull: false, defaultValue: 'OPEN' },
      ...ts,
    });

    await queryInterface.createTable('PosOrders', {
      id:            { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      companyId:     { type: Sequelize.INTEGER, allowNull: true },
      eventId:       fk('PosEvents', 'CASCADE', false),
      shiftId:       fk('PosShifts'),
      cashierId:     fk('Users'),
      clientOrderId: { type: Sequelize.STRING(64), allowNull: false },
      orderNumber:   { type: Sequelize.STRING(40), allowNull: false },
      soldAt:        { type: Sequelize.DATE, allowNull: false },
      subtotal:      { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      itemDiscount:  { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      orderDiscount: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      total:         { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      cashReceived:  { type: Sequelize.INTEGER, allowNull: true },
      change:        { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      customerName:  { type: Sequelize.STRING(100), allowNull: true },
      fulfillment:   { type: Sequelize.STRING(10), allowNull: false, defaultValue: 'NOW' },
      pickupCode:    { type: Sequelize.STRING(20), allowNull: true },
      pickupStatus:  { type: Sequelize.STRING(10), allowNull: false, defaultValue: 'DONE' },
      pickedUpAt:    { type: Sequelize.DATE, allowNull: true },
      pickedUpBy:    fk('Users'),
      customerPhone: { type: Sequelize.STRING(30), allowNull: true },
      discountNote:  { type: Sequelize.STRING(200), allowNull: true },
      note:          { type: Sequelize.STRING(200), allowNull: true },
      status:        { type: Sequelize.STRING(10), allowNull: false, defaultValue: 'PAID' },
      needsReview:   { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      reviewNote:    { type: Sequelize.TEXT, allowNull: true },
      StockOutHeaderId: fk('Stock_Out_Headers'),
      voidedAt:      { type: Sequelize.DATE, allowNull: true },
      voidedBy:      fk('Users'),
      voidReason:    { type: Sequelize.STRING(200), allowNull: true },
      ...ts,
    });
    // kunci idempotensi: transaksi yang dikirim ulang dari laptop kasir tidak boleh tercatat dua kali
    await queryInterface.addIndex('PosOrders', ['companyId', 'clientOrderId'], { unique: true, name: 'pos_orders_company_client_uq' });
    await queryInterface.addIndex('PosOrders', ['eventId', 'soldAt']);
    await queryInterface.addIndex('PosOrders', ['eventId', 'pickupStatus']);

    await queryInterface.createTable('PosOrderItems', {
      id:           { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      orderId:      fk('PosOrders', 'CASCADE', false),
      ProductId:    fk('Products'),
      ProductSKUId: fk('ProductSKUs'),
      name:         { type: Sequelize.STRING(200), allowNull: false },
      variant:      { type: Sequelize.STRING(100), allowNull: true },
      qty:          { type: Sequelize.INTEGER, allowNull: false },
      listPrice:    { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      unitPrice:    { type: Sequelize.INTEGER, allowNull: false },
      discount:     { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      lineTotal:    { type: Sequelize.INTEGER, allowNull: false },
      ...ts,
    });

    await queryInterface.createTable('PosPayments', {
      id:        { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      orderId:   fk('PosOrders', 'CASCADE', false),
      method:    { type: Sequelize.STRING(20), allowNull: false },
      amount:    { type: Sequelize.INTEGER, allowNull: false },
      reference: { type: Sequelize.STRING(100), allowNull: true },
      ...ts,
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('PosPayments');
    await queryInterface.dropTable('PosOrderItems');
    await queryInterface.dropTable('PosOrders');
    await queryInterface.dropTable('PosShifts');
    await queryInterface.dropTable('PosEvents');
  },
};
