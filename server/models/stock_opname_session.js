'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Stock_Opname_Session extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  Stock_Opname_Session.init({
    warehouseId: DataTypes.INTEGER,
    started_at: DataTypes.DATE,
    finished_at: DataTypes.DATE,
    status: DataTypes.STRING,
    createdBy: DataTypes.INTEGER,
    notes: DataTypes.TEXT
  }, {
    sequelize,
    modelName: 'Stock_Opname_Session',
  });
  return Stock_Opname_Session;
};