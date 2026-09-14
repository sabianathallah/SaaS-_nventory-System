'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class StockOutPurpose extends Model {
    static associate(models) {}
  }
  StockOutPurpose.init({
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notNull: { msg: 'Name is required' },
        notEmpty: { msg: 'Name is required' }
      }
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    companyId: { type: DataTypes.INTEGER, allowNull: true }
  }, {
    sequelize,
    modelName: 'StockOutPurpose',
  });
  return StockOutPurpose;
};
