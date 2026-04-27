'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class ProductVariantType extends Model {
    static associate(models) {
      ProductVariantType.belongsTo(models.Product, {
        foreignKey: { name: 'ProductId', allowNull: false },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      });
      ProductVariantType.hasMany(models.ProductVariantOption, {
        foreignKey: { name: 'ProductVariantTypeId', allowNull: false },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      });
    }
  }
  ProductVariantType.init({
    ProductId: { type: DataTypes.INTEGER, allowNull: false },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notNull: { msg: 'Variant type name is required' },
        notEmpty: { msg: 'Variant type name is required' },
      },
    },
    companyId: { type: DataTypes.INTEGER, allowNull: true },
  }, {
    sequelize,
    modelName: 'ProductVariantType',
  });
  return ProductVariantType;
};
