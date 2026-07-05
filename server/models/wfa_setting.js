'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class WfaSetting extends Model {
    static associate() {}
  }
  WfaSetting.init({
    companyId:           { type: DataTypes.INTEGER, allowNull: true, unique: true },
    defaultMonthlyQuota: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 4 },
  }, {
    sequelize,
    modelName: 'WfaSetting',
  });
  return WfaSetting;
};
