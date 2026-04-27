'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class ProductSKU extends Model {
    static associate(models) {
      ProductSKU.belongsTo(models.Product, {
        foreignKey: { name: 'ProductId', allowNull: false },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      });
      ProductSKU.belongsToMany(models.ProductVariantOption, {
        through: models.ProductSKUVariantOption,
        foreignKey: 'ProductSKUId',
        otherKey: 'ProductVariantOptionId',
      });
    }
  }
  ProductSKU.init({
    ProductId: { type: DataTypes.INTEGER, allowNull: false },
    sku_code: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: { msg: 'SKU code already exists' },
      validate: {
        notNull: { msg: 'SKU code is required' },
        notEmpty: { msg: 'SKU code is required' },
      },
    },
    price: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0,
      validate: { min: { args: [0], msg: 'Price cannot be negative' } },
    },
    qty: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: { min: { args: [0], msg: 'Qty cannot be negative' } },
    },
    companyId: { type: DataTypes.INTEGER, allowNull: true },
  }, {
    sequelize,
    modelName: 'ProductSKU',
  });
  return ProductSKU;
};
