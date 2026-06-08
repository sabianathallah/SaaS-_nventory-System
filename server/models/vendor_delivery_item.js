'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class VendorDeliveryItem extends Model {
    static associate(models) {
      VendorDeliveryItem.belongsTo(models.VendorDelivery, { foreignKey: 'deliveryId' });
      VendorDeliveryItem.belongsTo(models.Product,        { foreignKey: 'productId',    as: 'Product' });
      VendorDeliveryItem.belongsTo(models.ProductSKU,     { foreignKey: 'productSkuId', as: 'ProductSKU' });
    }
  }
  VendorDeliveryItem.init({
    deliveryId:   { type: DataTypes.INTEGER, allowNull: false },
    productId:    { type: DataTypes.INTEGER, allowNull: false },
    productSkuId: { type: DataTypes.INTEGER, allowNull: true },
    qtySJ:        { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    qtyActual:    { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    notes:        { type: DataTypes.TEXT, allowNull: true },
  }, { sequelize, modelName: 'VendorDeliveryItem' });
  return VendorDeliveryItem;
};
