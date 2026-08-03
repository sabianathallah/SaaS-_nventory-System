'use strict';
module.exports = {
  async up(queryInterface, DataTypes) {
    await queryInterface.createTable('ManualShipments', {
      id:                       { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      companyId:                { type: DataTypes.INTEGER, allowNull: true },
      invoiceNumber:            { type: DataTypes.STRING(30), allowNull: false },
      type:                     { type: DataTypes.ENUM('sales', 'non_sales'), allowNull: false },
      shipmentCategoryId:       { type: DataTypes.INTEGER, allowNull: true, references: { model: 'ShipmentCategories', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL' },
      status:                   { type: DataTypes.ENUM('in_progress', 'transferred', 'shipped', 'completed', 'cancelled'), allowNull: false, defaultValue: 'in_progress' },
      buyerName:                { type: DataTypes.STRING(150), allowNull: true },
      buyerAddress:             { type: DataTypes.TEXT, allowNull: true },
      buyerPhone:               { type: DataTypes.STRING(30), allowNull: true },
      recipientInfo:            { type: DataTypes.TEXT, allowNull: true },
      shippingCost:             { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
      subtotal:                 { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
      total:                    { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
      paymentProofUrl:          { type: DataTypes.TEXT, allowNull: true },
      paymentProofVerifiedBy:   { type: DataTypes.INTEGER, allowNull: true, references: { model: 'Users', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL' },
      paymentProofVerifiedAt:   { type: DataTypes.DATE, allowNull: true },
      expeditionName:           { type: DataTypes.STRING(100), allowNull: true },
      courierResiNumber:        { type: DataTypes.STRING(100), allowNull: true },
      courierResiImageUrl:      { type: DataTypes.TEXT, allowNull: true },
      notes:                    { type: DataTypes.TEXT, allowNull: true },
      cancelledReason:          { type: DataTypes.TEXT, allowNull: true },
      createdBy:                { type: DataTypes.INTEGER, allowNull: true, references: { model: 'Users', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL' },
      createdAt:                { type: DataTypes.DATE, allowNull: false },
      updatedAt:                { type: DataTypes.DATE, allowNull: false },
    });

    await queryInterface.addIndex('ManualShipments', ['invoiceNumber'], { unique: true, name: 'manual_shipments_invoice_unique' });
    await queryInterface.addIndex('ManualShipments', ['companyId', 'status']);
    await queryInterface.addIndex('ManualShipments', ['companyId', 'type']);
  },
  async down(queryInterface) {
    await queryInterface.dropTable('ManualShipments');
  },
};
