'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Stock_Opname_Item extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      Stock_Opname_Item.belongsTo(models.Stock_Opname_Session, {
        foreignKey: { name: 'SessionId', allowNull: false },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      });
      Stock_Opname_Item.belongsTo(models.Product, {
        foreignKey: { name: 'ProductId', allowNull: false },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      });
    }
  }
  Stock_Opname_Item.init({
    SessionId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        notNull: { msg: 'Session is required' },
        notEmpty: { msg: 'Session is required' }
      }
    },
    ProductId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        notNull: { msg: 'Product is required' },
        notEmpty: { msg: 'Product is required' }
      }
    },
    scanned_qty: {
      type: DataTypes.INTEGER,
      validate: { min: 0 }
    },
    system_qty: {
      type: DataTypes.INTEGER,
      validate: { min: 0 }
    },
    difference: DataTypes.INTEGER
  }, {
    sequelize,
    modelName: 'Stock_Opname_Item',
  });
  return Stock_Opname_Item;
};