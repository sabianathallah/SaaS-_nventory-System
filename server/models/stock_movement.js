'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Stock_Movement extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      Stock_Movement.belongsTo(models.Product, {
        foreignKey: { name: 'ProductId', allowNull: false },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      });
      Stock_Movement.belongsTo(models.Warehouse, {
        foreignKey: { name: 'WarehouseId', allowNull: false },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      });
      Stock_Movement.belongsTo(models.ProductSKU, {
        foreignKey: { name: 'ProductSKUId', allowNull: true },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE'
      });
    }
  }
  Stock_Movement.init({
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
    type: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notNull: { msg: 'Type is required' },
        notEmpty: { msg: 'Type is required' }
      }
    },
    quantity: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: { min: 0 }
    },
    ProductSKUId: { type: DataTypes.INTEGER, allowNull: true },
    ReferenceId: DataTypes.BIGINT,
    note: DataTypes.TEXT,
    companyId: { type: DataTypes.INTEGER, allowNull: true }
  }, {
    sequelize,
    modelName: 'Stock_Movement',
  });
  return Stock_Movement;
};