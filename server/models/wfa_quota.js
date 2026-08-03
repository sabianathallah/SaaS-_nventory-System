'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class WfaQuota extends Model {
    static associate(models) {
      WfaQuota.belongsTo(models.User, {
        foreignKey: { name: 'userId', allowNull: false },
        as: 'user',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      });
    }
  }
  WfaQuota.init({
    userId:     { type: DataTypes.INTEGER, allowNull: false },
    month:      { type: DataTypes.INTEGER, allowNull: false },
    year:       { type: DataTypes.INTEGER, allowNull: false },
    allocated:  { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    used:       { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    companyId:  { type: DataTypes.INTEGER, allowNull: true },
  }, {
    sequelize,
    modelName: 'WfaQuota',
    tableName: 'WfaQuotas',
  });
  return WfaQuota;
};
