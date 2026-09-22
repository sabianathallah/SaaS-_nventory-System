'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  // Jejak audit perubahan kebijakan poin HRIS. `changes` berisi
  // { namaSetting: { from, to } } hanya untuk field yang benar-benar berubah.
  class HrisSettingLog extends Model {
    static associate(models) {
      HrisSettingLog.belongsTo(models.User, {
        foreignKey: { name: 'changedBy', allowNull: true },
        as: 'changer',
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      });
    }
  }
  HrisSettingLog.init({
    companyId: { type: DataTypes.INTEGER, allowNull: true },
    changedBy: { type: DataTypes.INTEGER, allowNull: true },
    changes:   { type: DataTypes.JSON, allowNull: false },
  }, {
    sequelize,
    modelName: 'HrisSettingLog',
  });
  return HrisSettingLog;
};
