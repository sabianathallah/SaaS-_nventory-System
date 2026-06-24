'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class RequestType extends Model {
    static associate(models) {
      RequestType.hasMany(models.Request, { foreignKey: 'requestTypeId' });
    }
  }
  RequestType.init({
    name:      { type: DataTypes.STRING(100), allowNull: false },
    companyId: { type: DataTypes.INTEGER, allowNull: true },
    isActive:  { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  }, {
    sequelize,
    modelName: 'RequestType',
    tableName: 'RequestTypes',
  });
  return RequestType;
};
