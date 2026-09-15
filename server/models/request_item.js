'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class RequestItem extends Model {
    static associate(models) {
      RequestItem.belongsTo(models.Request, { foreignKey: 'requestId' });
      RequestItem.belongsTo(models.ProductSKU, { foreignKey: 'ProductSKUId', as: 'sku' });
    }
  }
  RequestItem.init({
    requestId:    { type: DataTypes.INTEGER, allowNull: false },
    ProductSKUId: { type: DataTypes.INTEGER, allowNull: true },
    productName:  { type: DataTypes.STRING(300), allowNull: false },
    variantLabel: { type: DataTypes.STRING(200), allowNull: true },
    qty:          { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
    shippedQty:   { type: DataTypes.INTEGER, allowNull: true },
    note:         { type: DataTypes.TEXT, allowNull: true },
    companyId:    { type: DataTypes.INTEGER, allowNull: true },
  }, {
    sequelize,
    modelName: 'RequestItem',
    tableName: 'RequestItems',
  });
  return RequestItem;
};
