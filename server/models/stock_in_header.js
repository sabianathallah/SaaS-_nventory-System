'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Stock_In_Header extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      Stock_In_Header.belongsTo(models.Supplier, {
        foreignKey: { name: 'SupplierId', allowNull: false },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      });
    }
  }
  Stock_In_Header.init({
    SupplierId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        notNull: { msg: 'Supplier is required' },
        notEmpty: { msg: 'Supplier is required' }
      }
    },
    date: {
      type: DataTypes.DATE,
      allowNull: false,
      validate: {
        notNull: { msg: 'Date is required' },
        notEmpty: { msg: 'Date is required' }
      }
    },
    note: DataTypes.STRING
  }, {
    sequelize,
    modelName: 'Stock_In_Header',
  });
  return Stock_In_Header;
};