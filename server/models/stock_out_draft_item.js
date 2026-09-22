'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Stock_Out_Draft_Item extends Model {
    static associate(models) {
      Stock_Out_Draft_Item.belongsTo(models.Stock_Out_Draft, {
        foreignKey: { name: 'DraftId', allowNull: false },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      });
      Stock_Out_Draft_Item.belongsTo(models.ProductSKU, {
        foreignKey: { name: 'ProductSKUId', allowNull: true },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      });
      Stock_Out_Draft_Item.belongsTo(models.Product, {
        foreignKey: { name: 'ProductId', allowNull: true },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      });
    }
  }
  Stock_Out_Draft_Item.init({
    DraftId:      { type: DataTypes.INTEGER, allowNull: false },
    ProductSKUId: { type: DataTypes.INTEGER, allowNull: true },
    ProductId:    { type: DataTypes.INTEGER, allowNull: true },
    quantity:     { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
    companyId:    { type: DataTypes.INTEGER, allowNull: true },
  }, { sequelize, modelName: 'Stock_Out_Draft_Item' });
  return Stock_Out_Draft_Item;
};
