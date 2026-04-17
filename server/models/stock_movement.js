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
      // define association here
    }
  }
  Stock_Movement.init({
    ProductId: DataTypes.INTEGER,
    WearhouseId: DataTypes.INTEGER,
    type: DataTypes.STRING,
    quantity: DataTypes.INTEGER,
    ReferenceId: DataTypes.BIGINT,
    note: DataTypes.TEXT
  }, {
    sequelize,
    modelName: 'Stock_Movement',
  });
  return Stock_Movement;
};