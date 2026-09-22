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
    lateExcuseBonus:   { type: DataTypes.INTEGER, allowNull: false, defaultValue: 5 },
    scoreHalfDay:      { type: DataTypes.INTEGER, allowNull: false, defaultValue: 50 },
    fieldPendingScore: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 75 },
    // Poin lama jam kerja — bobot 0 = skor harian murni dari jam datang.
    workDurationWeight: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    scoreWorkOvertime:  { type: DataTypes.INTEGER, allowNull: false, defaultValue: 100 },
    scoreWorkFull:      { type: DataTypes.INTEGER, allowNull: false, defaultValue: 100 },
    scoreWorkTier1:     { type: DataTypes.INTEGER, allowNull: false, defaultValue: 90 },
    scoreWorkTier2:     { type: DataTypes.INTEGER, allowNull: false, defaultValue: 80 },
    scoreWorkTier3:     { type: DataTypes.INTEGER, allowNull: false, defaultValue: 70 },
    // Batas menit tiap tier (telat dari jam shift / kurang dari target durasi).
    lateTier1Max:       { type: DataTypes.INTEGER, allowNull: false, defaultValue: 29 },
    lateTier2Max:       { type: DataTypes.INTEGER, allowNull: false, defaultValue: 45 },
    lateTier3Max:       { type: DataTypes.INTEGER, allowNull: false, defaultValue: 60 },
    workShortTier1Max:  { type: DataTypes.INTEGER, allowNull: false, defaultValue: 29 },
    workShortTier2Max:  { type: DataTypes.INTEGER, allowNull: false, defaultValue: 60 },
    workOvertimeMinMinutes: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 60 },
    // Minimum hari terhitung untuk masuk papan skor.
    leaderboardMinDays: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 10 },
  }, {
    sequelize,
    modelName: 'HrisSetting',
  });
  return HrisSetting;
};
