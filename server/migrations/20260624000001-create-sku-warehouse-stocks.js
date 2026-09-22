'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('SkuWarehouseStocks', {
      id:           { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      ProductSKUId: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'ProductSKUs', key: 'id' }, onDelete: 'CASCADE', onUpdate: 'CASCADE' },
      WarehouseId:  { type: Sequelize.INTEGER, allowNull: false, references: { model: 'Warehouses',  key: 'id' }, onDelete: 'CASCADE', onUpdate: 'CASCADE' },
      qty:          { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      companyId:    { type: Sequelize.INTEGER, allowNull: true },
      createdAt:    { type: Sequelize.DATE, allowNull: false },
      updatedAt:    { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('SkuWarehouseStocks', ['ProductSKUId', 'WarehouseId'], { unique: true, name: 'sku_warehouse_stocks_unique' });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('SkuWarehouseStocks');
  },
};
