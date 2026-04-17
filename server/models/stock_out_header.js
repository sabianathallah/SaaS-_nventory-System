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
      // define association here
    }
  }
  Stock_Out_Header.init({
    destination: DataTypes.STRING,
    date: DataTypes.DATE,
    notes: DataTypes.STRING,
    createdBy: DataTypes.INTEGER
  }, {
    sequelize,
    modelName: 'Stock_Out_Header',
  });
  return Stock_Out_Header;
};