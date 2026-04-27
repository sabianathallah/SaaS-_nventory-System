'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Stock_In_Item extends Model {
    static associate(models) {
      Stock_In_Item.belongsTo(models.Stock_In_Header, {
        foreignKey: { name: 'StockInHeaderId', allowNull: false },
        onDelete: 'CASCADE',
      });
      Stock_In_Item.belongsTo(models.ProductSKU, {
        foreignKey: { name: 'ProductSKUId', allowNull: true },
        onDelete: 'SET NULL',
      });
    }
  }
  Stock_In_Item.init({
    StockInHeaderId: { type: DataTypes.INTEGER, allowNull: false },
    ProductSKUId:    { type: DataTypes.INTEGER, allowNull: true },
    quantity:        { type: DataTypes.INTEGER,        allowNull: false, defaultValue: 1 },
    price:           { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
    companyId:       { type: DataTypes.INTEGER, allowNull: true },
  }, { sequelize, modelName: 'Stock_In_Item' });
  return Stock_In_Item;
};
