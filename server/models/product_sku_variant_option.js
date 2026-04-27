'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class ProductSKUVariantOption extends Model {
    static associate(models) {
      ProductSKUVariantOption.belongsTo(models.ProductSKU, {
        foreignKey: { name: 'ProductSKUId', allowNull: false },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      });
      ProductSKUVariantOption.belongsTo(models.ProductVariantOption, {
        foreignKey: { name: 'ProductVariantOptionId', allowNull: false },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      });
    }
  }
  ProductSKUVariantOption.init({
    ProductSKUId:          { type: DataTypes.INTEGER, allowNull: false },
    ProductVariantOptionId: { type: DataTypes.INTEGER, allowNull: false },
  }, {
    sequelize,
    modelName: 'ProductSKUVariantOption',
  });
  return ProductSKUVariantOption;
};
