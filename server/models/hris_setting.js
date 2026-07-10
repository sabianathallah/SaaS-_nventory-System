'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class HrisSetting extends Model {
    static associate() {}
  }
  HrisSetting.init({
    companyId:        { type: DataTypes.INTEGER, allowNull: true, unique: true },
    minWorkMinutes:   { type: DataTypes.INTEGER, allowNull: false, defaultValue: 480 },
    lateGraceMinutes: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 15 },
  }, {
    sequelize,
    modelName: 'HrisSetting',
  });
  return HrisSetting;
};
