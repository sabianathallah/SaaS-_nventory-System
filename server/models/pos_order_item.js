'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class PosOrderItem extends Model {
    static associate(models) {
      PosOrderItem.belongsTo(models.PosOrder,   { foreignKey: 'orderId', as: 'order' });
      PosOrderItem.belongsTo(models.Product,    { foreignKey: 'ProductId' });
      PosOrderItem.belongsTo(models.ProductSKU, { foreignKey: 'ProductSKUId' });
    }
  }
  PosOrderItem.init({
    orderId:      { type: DataTypes.INTEGER, allowNull: false },
    ProductId:    { type: DataTypes.INTEGER, allowNull: true },
    ProductSKUId: { type: DataTypes.INTEGER, allowNull: true },
    // snapshot nama & varian saat dijual, supaya struk/laporan tetap benar walau produk diganti nama
    name:         { type: DataTypes.STRING(200), allowNull: false },
    variant:      { type: DataTypes.STRING(100), allowNull: true },
    qty:          { type: DataTypes.INTEGER, allowNull: false },
    listPrice:    { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    unitPrice:    { type: DataTypes.INTEGER, allowNull: false },
    discount:     { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    lineTotal:    { type: DataTypes.INTEGER, allowNull: false },
  }, { sequelize, modelName: 'PosOrderItem' });
  return PosOrderItem;
};
