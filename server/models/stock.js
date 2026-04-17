'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Stock extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      Stock.belongsTo(models.Product, {
        foreignKey: { name: 'ProductId', allowNull: false },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      });
      Stock.belongsTo(models.Warehouse, {
        foreignKey: { name: 'WarehouseId', allowNull: false },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      });
    }
  }
  Stock.init({
    ProductId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        notNull: { msg: 'Product is required' },
        notEmpty: { msg: 'Product is required' }
      }
    },
    WarehouseId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        notNull: { msg: 'Warehouse is required' },
        notEmpty: { msg: 'Warehouse is required' }
      }
    },
    quantity: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        notNull: { msg: 'Quantity is required' },
        notEmpty: { msg: 'Quantity is required' },
        min: 0
      }
    }
  }, {
    sequelize,
    modelName: 'Stock',
  });
  return Stock;
};