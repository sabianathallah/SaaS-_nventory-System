'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class StockTransfer extends Model {
    static associate(models) {
      StockTransfer.belongsTo(models.Warehouse, { foreignKey: 'fromWarehouseId', as: 'FromWarehouse' });
      StockTransfer.belongsTo(models.Warehouse, { foreignKey: 'toWarehouseId',   as: 'ToWarehouse'   });
      StockTransfer.belongsTo(models.User,      { foreignKey: 'createdBy',        as: 'Creator'       });
      StockTransfer.hasMany(models.StockTransferItem, { foreignKey: 'transferId', as: 'items' });
    }
  }
  StockTransfer.init({
    companyId:       { type: DataTypes.INTEGER,    allowNull: true },
    fromWarehouseId: { type: DataTypes.INTEGER,    allowNull: false },
    toWarehouseId:   { type: DataTypes.INTEGER,    allowNull: false },
    transferType:    { type: DataTypes.STRING(40), allowNull: false, defaultValue: 'TRANSFER' },
    note:            { type: DataTypes.TEXT,       allowNull: true },
    date:            { type: DataTypes.DATEONLY,   allowNull: false },
    createdBy:       { type: DataTypes.INTEGER,    allowNull: true },
  }, { sequelize, modelName: 'StockTransfer' });
  return StockTransfer;
};
