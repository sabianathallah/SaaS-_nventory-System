'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Stock_Out_Draft extends Model {
    static associate(models) {
      Stock_Out_Draft.belongsTo(models.Warehouse, {
        foreignKey: { name: 'WarehouseId', allowNull: true },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      });
      Stock_Out_Draft.belongsTo(models.User, {
        foreignKey: { name: 'createdBy', allowNull: false },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      });
      Stock_Out_Draft.hasMany(models.Stock_Out_Draft_Item, {
        foreignKey: 'DraftId',
        onDelete: 'CASCADE',
      });
      Stock_Out_Draft.belongsTo(models.Request, {
        foreignKey: { name: 'sourceRequestId', allowNull: true },
        as: 'sourceRequest',
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      });
    }
  }
  Stock_Out_Draft.init({
    WarehouseId: { type: DataTypes.INTEGER, allowNull: true },
    date:        { type: DataTypes.DATEONLY, allowNull: true },
    purpose:     { type: DataTypes.STRING,   allowNull: true },
    note:        { type: DataTypes.STRING,   allowNull: true },
    status:      { type: DataTypes.STRING,   allowNull: false, defaultValue: 'draft' },
    createdBy:   { type: DataTypes.INTEGER,  allowNull: false },
    companyId:   { type: DataTypes.INTEGER,  allowNull: true },
    sourceRequestId: { type: DataTypes.INTEGER, allowNull: true },
  }, { sequelize, modelName: 'Stock_Out_Draft' });
  return Stock_Out_Draft;
};
