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
    scoreOnTime:       { type: DataTypes.INTEGER, allowNull: false, defaultValue: 100 },
    scoreLateTier1:    { type: DataTypes.INTEGER, allowNull: false, defaultValue: 90 },
    scoreLateTier2:    { type: DataTypes.INTEGER, allowNull: false, defaultValue: 85 },
    scoreLateTier3:    { type: DataTypes.INTEGER, allowNull: false, defaultValue: 80 },
    scoreLateTier4:    { type: DataTypes.INTEGER, allowNull: false, defaultValue: 75 },
    scoreLateExcused:  { type: DataTypes.INTEGER, allowNull: false, defaultValue: 70 },
    scoreHalfDay:      { type: DataTypes.INTEGER, allowNull: false, defaultValue: 50 },
    fieldPendingScore: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 75 },
  }, {
    sequelize,
    modelName: 'HrisSetting',
  });
  return HrisSetting;
};
