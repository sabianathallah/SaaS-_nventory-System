'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class ManualShipmentItem extends Model {
    static associate(models) {
      ManualShipmentItem.belongsTo(models.ManualShipment, { foreignKey: 'shipmentId', as: 'shipment' });
      ManualShipmentItem.belongsTo(models.Product,        { foreignKey: 'productId',  as: 'product' });
      ManualShipmentItem.belongsTo(models.ProductSKU,     { foreignKey: 'productSkuId', as: 'productSku' });
    }
  }
  ManualShipmentItem.init({
    shipmentId:      { type: DataTypes.INTEGER,     allowNull: false },
    productId:       { type: DataTypes.INTEGER,     allowNull: true },
    productSkuId:    { type: DataTypes.INTEGER,     allowNull: true },
    productName:     { type: DataTypes.STRING(200), allowNull: false },
    variantName:     { type: DataTypes.STRING(200), allowNull: true },
    productImageUrl: { type: DataTypes.TEXT,        allowNull: true },
    sku:             { type: DataTypes.STRING(100), allowNull: true },
    quantity:        { type: DataTypes.INTEGER,     allowNull: false },
    unitPrice:       { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
    subtotal:        { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
  }, { sequelize, modelName: 'ManualShipmentItem' });
  return ManualShipmentItem;
};
