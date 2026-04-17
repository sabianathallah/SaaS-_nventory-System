'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Product extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      Product.belongsTo(models.Category, {
        foreignKey: { name: 'CategoryId', allowNull: false },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      });
      Product.hasMany(models.Stock, {
        foreignKey: { name: 'ProductId', allowNull: false },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      });
      Product.hasMany(models.Stock_Movement, {
        foreignKey: { name: 'ProductId', allowNull: false },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      });
      Product.hasMany(models.Stock_Opname_Item, {
        foreignKey: { name: 'ProductId', allowNull: false },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      });
    }
  }
  Product.init({
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: { notEmpty: { msg: 'Name is required' } }
    },
    sku: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: { notEmpty: { msg: 'SKU is required' } }
    },
    barcode: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: { notEmpty: { msg: 'Barcode is required' } }
    },
    qrString: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: { notEmpty: { msg: 'QR string is required' } }
    },
    CategoryId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: { notEmpty: { msg: 'Category is required' } }
    },
    unit: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: { notEmpty: { msg: 'Unit is required' } }
    }
  }, {
    sequelize,
    modelName: 'Product',
  });
  return Product;
};