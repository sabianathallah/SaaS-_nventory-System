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
      // define association here
    }
  }
  Stock_Opname_Item.init({
    SessionId: DataTypes.INTEGER,
    ProductId: DataTypes.INTEGER,
    scanned_qty: DataTypes.INTEGER,
    system_qty: DataTypes.INTEGER,
    difference: DataTypes.INTEGER
  }, {
    sequelize,
    modelName: 'Stock_Opname_Item',
  });
  return Stock_Opname_Item;
};