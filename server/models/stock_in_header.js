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
      // define association here
    }
  }
  Stock_In_Header.init({
    SupplierId: DataTypes.INTEGER,
    date: DataTypes.DATE,
    note: DataTypes.STRING
  }, {
    sequelize,
    modelName: 'Stock_In_Header',
  });
  return Stock_In_Header;
};