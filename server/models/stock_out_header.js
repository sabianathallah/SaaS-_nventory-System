'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Stock_Out_Header extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      Stock_Out_Header.belongsTo(models.User, {
        foreignKey: { name: 'createdBy', allowNull: false },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      });
    }
  }
  Stock_Out_Header.init({
    destination: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: { notEmpty: { msg: 'Destination is required' } }
    },
    date: {
      type: DataTypes.DATE,
      allowNull: false,
      validate: { notEmpty: { msg: 'Date is required' } }
    },
    notes: DataTypes.STRING,
    createdBy: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: { notEmpty: { msg: 'Creator is required' } }
    }
  }, {
    sequelize,
    modelName: 'Stock_Out_Header',
  });
  return Stock_Out_Header;
};