'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class SkuWarehouseStock extends Model {
    static associate(models) {
      SkuWarehouseStock.belongsTo(models.ProductSKU, {
        foreignKey: { name: 'ProductSKUId', allowNull: false },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      });
      SkuWarehouseStock.belongsTo(models.Warehouse, {
        foreignKey: { name: 'WarehouseId', allowNull: false },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      });
    }
  }
  SkuWarehouseStock.init({
    ProductSKUId: { type: DataTypes.INTEGER, allowNull: false },
    WarehouseId:  { type: DataTypes.INTEGER, allowNull: false },
    qty:          { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    companyId:    { type: DataTypes.INTEGER, allowNull: true },
  }, {
    sequelize,
    modelName: 'SkuWarehouseStock',
    indexes: [{ unique: true, fields: ['ProductSKUId', 'WarehouseId'] }],
  });
  return SkuWarehouseStock;
};
