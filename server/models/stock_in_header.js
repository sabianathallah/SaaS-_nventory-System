'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Stock_In_Header extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      Stock_In_Header.belongsTo(models.Supplier, {
        foreignKey: { name: 'SupplierId', allowNull: true },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE'
      });
      Stock_In_Header.belongsTo(models.Warehouse, {
        foreignKey: { name: 'WarehouseId', allowNull: true },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE'
      });
      Stock_In_Header.belongsTo(models.User, {
        foreignKey: { name: 'createdBy', allowNull: true },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE'
      });
      Stock_In_Header.belongsTo(models.User, {
        foreignKey: { name: 'updatedBy', allowNull: true },
        as: 'updater',
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE'
      });
      Stock_In_Header.hasMany(models.Stock_In_Item, {
        foreignKey: 'StockInHeaderId',
        onDelete: 'CASCADE',
      });
      Stock_In_Header.belongsTo(models.Vendor, {
        foreignKey: { name: 'VendorId', allowNull: true },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE'
      });
      Stock_In_Header.belongsTo(models.VendorDelivery, {
        foreignKey: { name: 'sourceDeliveryId', allowNull: true },
        as: 'sourceDelivery',
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE'
      });
    }
  }
  Stock_In_Header.init({
    SupplierId:  { type: DataTypes.INTEGER, allowNull: true },
    WarehouseId: { type: DataTypes.INTEGER, allowNull: true },
    VendorId:         { type: DataTypes.INTEGER, allowNull: true },
    sourceDeliveryId: { type: DataTypes.INTEGER, allowNull: true },
    date: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    note:      DataTypes.STRING,
    // Sesi edit: 'closed' = terkunci (default), 'open' = item bisa diedit
    status:    { type: DataTypes.STRING(10), allowNull: false, defaultValue: 'closed' },
    createdBy: { type: DataTypes.INTEGER, allowNull: true },
    updatedBy: { type: DataTypes.INTEGER, allowNull: true },
    companyId: { type: DataTypes.INTEGER, allowNull: true }
  }, {
    sequelize,
    modelName: 'Stock_In_Header',
  });
  return Stock_In_Header;
};