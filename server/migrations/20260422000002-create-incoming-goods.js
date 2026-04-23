'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('IncomingGoods', {
      id:                   { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      docNumber:            { type: Sequelize.STRING(100), allowNull: false, unique: true },
      VendorId:             { type: Sequelize.INTEGER, allowNull: false, references: { model: 'Vendors', key: 'id' }, onDelete: 'CASCADE', onUpdate: 'CASCADE' },
      receivedBy:           { type: Sequelize.INTEGER, allowNull: false, references: { model: 'Users', key: 'id' }, onDelete: 'CASCADE', onUpdate: 'CASCADE' },
      receivedDate:         { type: Sequelize.DATEONLY, allowNull: false },
      vendorDeliveryNote:   { type: Sequelize.STRING(255), allowNull: true },
      status:               { type: Sequelize.ENUM('DRAFT','VENDOR_CONFIRMED','PRODUCTION_NOTIFIED','PACKING_IN_PROGRESS','COMPLETED'), allowNull: false, defaultValue: 'DRAFT' },
      totalItems:           { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      totalQty:             { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      notes:                { type: Sequelize.TEXT, allowNull: true },
      vendorConfirmedAt:    { type: Sequelize.DATE, allowNull: true },
      productionNotifiedAt: { type: Sequelize.DATE, allowNull: true },
      completedAt:          { type: Sequelize.DATE, allowNull: true },
      companyId:            { type: Sequelize.INTEGER, allowNull: true },
      createdAt:            { type: Sequelize.DATE, allowNull: false },
      updatedAt:            { type: Sequelize.DATE, allowNull: false },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('IncomingGoods');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_IncomingGoods_status";');
  },
};
