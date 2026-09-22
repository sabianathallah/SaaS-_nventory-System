'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class RequestType extends Model {
    static associate(models) {
      RequestType.hasMany(models.Request, { foreignKey: 'requestTypeId' });
    }
  }
  RequestType.init({
    name:             { type: DataTypes.STRING(100), allowNull: false },
    companyId:        { type: DataTypes.INTEGER, allowNull: true },
    isActive:         { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    requiresShipping: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    // 'sales' | 'non_sales' | 'stock_out' | null
    shipmentType:     { type: DataTypes.STRING(20), allowNull: true, defaultValue: null },
  }, {
    sequelize,
    modelName: 'RequestType',
    tableName: 'RequestTypes',
  });
  return RequestType;
};
