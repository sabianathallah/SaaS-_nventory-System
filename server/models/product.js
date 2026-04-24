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
      validate: {
        notNull: { msg: 'Name is required' },
        notEmpty: { msg: 'Name is required' }
      }
    },
    sku: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: { msg: 'SKU already exists' },
      validate: {
        notNull: { msg: 'SKU is required' },
        notEmpty: { msg: 'SKU is required' }
      }
    },
    barcode: {
      type: DataTypes.STRING,
      allowNull: true,
      unique: { msg: 'Barcode already exists' }
    },
    qrString: {
      type: DataTypes.STRING,
      allowNull: true,
      unique: { msg: 'QR string already exists' }
    },
    CategoryId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        notNull: { msg: 'Category is required' },
        notEmpty: { msg: 'Category is required' }
      }
    },
    unit: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notNull: { msg: 'Unit is required' },
        notEmpty: { msg: 'Unit is required' }
      }
    },
    companyId: { type: DataTypes.INTEGER, allowNull: true }
  }, {
    sequelize,
    modelName: 'Product',
  });
  return Product;
};