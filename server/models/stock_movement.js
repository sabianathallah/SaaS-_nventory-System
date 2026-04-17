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
        foreignKey: { name: 'WearhouseId', allowNull: false },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      });
    }
  }
  Stock_Movement.init({
    ProductId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: { notEmpty: { msg: 'Product is required' } }
    },
    WearhouseId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: { notEmpty: { msg: 'Warehouse is required' } }
    },
    type: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: { notEmpty: { msg: 'Type is required' } }
    },
    quantity: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: { min: 0 }
    },
    ReferenceId: DataTypes.BIGINT,
    note: DataTypes.TEXT
  }, {
    sequelize,
    modelName: 'Stock_Movement',
  });
  return Stock_Movement;
};