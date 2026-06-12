'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class StockTransferItem extends Model {
    static associate(models) {
      StockTransferItem.belongsTo(models.StockTransfer, { foreignKey: 'transferId', as: 'transfer' });
      StockTransferItem.belongsTo(models.ProductSKU,    { foreignKey: 'productSkuId', as: 'ProductSKU' });
    }
  }
  StockTransferItem.init({
    transferId:   { type: DataTypes.INTEGER, allowNull: false },
    productSkuId: { type: DataTypes.INTEGER, allowNull: false },
    quantity:     { type: DataTypes.INTEGER, allowNull: false },
  }, { sequelize, modelName: 'StockTransferItem' });
  return StockTransferItem;
};
