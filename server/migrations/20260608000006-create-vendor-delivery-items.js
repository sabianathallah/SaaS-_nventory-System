'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('VendorDeliveryItems', {
      id:           { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      deliveryId:   { type: Sequelize.INTEGER, allowNull: false, references: { model: 'VendorDeliveries', key: 'id' }, onDelete: 'CASCADE', onUpdate: 'CASCADE' },
      productId:    { type: Sequelize.INTEGER, allowNull: false, references: { model: 'Products', key: 'id' }, onDelete: 'CASCADE', onUpdate: 'CASCADE' },
      productSkuId: { type: Sequelize.INTEGER, allowNull: true,  references: { model: 'ProductSKUs', key: 'id' }, onDelete: 'SET NULL', onUpdate: 'CASCADE' },
      qtySJ:        { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      qtyActual:    { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      notes:        { type: Sequelize.TEXT, allowNull: true },
      createdAt:    { type: Sequelize.DATE, allowNull: false },
      updatedAt:    { type: Sequelize.DATE, allowNull: false },
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('VendorDeliveryItems');
  },
};
