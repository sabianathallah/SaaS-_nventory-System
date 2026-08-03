'use strict';
module.exports = {
  async up(queryInterface, DataTypes) {
    await queryInterface.createTable('StockTransfers', {
      id:               { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      companyId:        { type: DataTypes.INTEGER, allowNull: true },
      fromWarehouseId:  { type: DataTypes.INTEGER, allowNull: false, references: { model: 'Warehouses', key: 'id' } },
      toWarehouseId:    { type: DataTypes.INTEGER, allowNull: false, references: { model: 'Warehouses', key: 'id' } },
      transferType:     { type: DataTypes.STRING(40), allowNull: false, defaultValue: 'TRANSFER' },
      note:             { type: DataTypes.TEXT, allowNull: true },
      date:             { type: DataTypes.DATEONLY, allowNull: false },
      createdBy:        { type: DataTypes.INTEGER, allowNull: true, references: { model: 'Users', key: 'id' } },
      createdAt:        { type: DataTypes.DATE, allowNull: false },
      updatedAt:        { type: DataTypes.DATE, allowNull: false },
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('StockTransfers');
  },
};
