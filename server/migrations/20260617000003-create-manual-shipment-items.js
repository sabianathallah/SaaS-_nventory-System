'use strict';
module.exports = {
  async up(queryInterface, DataTypes) {
    await queryInterface.createTable('ManualShipmentItems', {
      id:              { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      shipmentId:      { type: DataTypes.INTEGER, allowNull: false, references: { model: 'ManualShipments', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
      productId:       { type: DataTypes.INTEGER, allowNull: true, references: { model: 'Products', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL' },
      productSkuId:    { type: DataTypes.INTEGER, allowNull: true, references: { model: 'ProductSKUs', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL' },
      productName:     { type: DataTypes.STRING(200), allowNull: false },
      variantName:     { type: DataTypes.STRING(200), allowNull: true },
      productImageUrl: { type: DataTypes.TEXT, allowNull: true },
      sku:             { type: DataTypes.STRING(100), allowNull: true },
      quantity:        { type: DataTypes.INTEGER, allowNull: false },
      unitPrice:       { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
      subtotal:        { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
      createdAt:       { type: DataTypes.DATE, allowNull: false },
      updatedAt:       { type: DataTypes.DATE, allowNull: false },
    });

    await queryInterface.addIndex('ManualShipmentItems', ['shipmentId']);
  },
  async down(queryInterface) {
    await queryInterface.dropTable('ManualShipmentItems');
  },
};
