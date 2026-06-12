'use strict';
module.exports = {
  async up(queryInterface, DataTypes) {
    await queryInterface.createTable('StockTransferItems', {
      id:           { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      transferId:   { type: DataTypes.INTEGER, allowNull: false, references: { model: 'StockTransfers', key: 'id' }, onDelete: 'CASCADE' },
      productSkuId: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'ProductSKUs', key: 'id' } },
      quantity:     { type: DataTypes.INTEGER, allowNull: false },
      createdAt:    { type: DataTypes.DATE, allowNull: false },
      updatedAt:    { type: DataTypes.DATE, allowNull: false },
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('StockTransferItems');
  },
};
