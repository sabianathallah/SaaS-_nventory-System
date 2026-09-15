'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class ProductVariantOption extends Model {
    static associate(models) {
      ProductVariantOption.belongsTo(models.ProductVariantType, {
        foreignKey: { name: 'ProductVariantTypeId', allowNull: false },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      });
      ProductVariantOption.belongsToMany(models.ProductSKU, {
        through: models.ProductSKUVariantOption,
        foreignKey: 'ProductVariantOptionId',
        otherKey: 'ProductSKUId',
      });
    }
  }
  ProductVariantOption.init({
    ProductVariantTypeId: { type: DataTypes.INTEGER, allowNull: false },
    value: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notNull: { msg: 'Option value is required' },
        notEmpty: { msg: 'Option value is required' },
      },
    },
    position: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  }, {
    sequelize,
    modelName: 'ProductVariantOption',
  });
  return ProductVariantOption;
};
