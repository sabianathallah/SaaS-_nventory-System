'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Stock_In_Draft extends Model {
    static associate(models) {
      Stock_In_Draft.belongsTo(models.Warehouse, {
        foreignKey: { name: 'WarehouseId', allowNull: true },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      });
      Stock_In_Draft.belongsTo(models.User, {
        foreignKey: { name: 'createdBy', allowNull: false },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      });
      Stock_In_Draft.hasMany(models.Stock_In_Draft_Item, {
        foreignKey: 'DraftId',
        onDelete: 'CASCADE',
      });
    }
  }
  Stock_In_Draft.init({
    WarehouseId: { type: DataTypes.INTEGER, allowNull: true },
    date:        { type: DataTypes.DATEONLY, allowNull: true },
    note:        { type: DataTypes.STRING,   allowNull: true },
    status:      { type: DataTypes.STRING,   allowNull: false, defaultValue: 'draft' },
    createdBy:   { type: DataTypes.INTEGER,  allowNull: false },
    companyId:   { type: DataTypes.INTEGER,  allowNull: true },
  }, { sequelize, modelName: 'Stock_In_Draft' });
  return Stock_In_Draft;
};
