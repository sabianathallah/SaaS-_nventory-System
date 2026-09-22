'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class LateExcuseRequest extends Model {
    static associate(models) {
      LateExcuseRequest.belongsTo(models.User, {
        foreignKey: { name: 'userId', allowNull: false },
        as: 'user',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      });
      LateExcuseRequest.belongsTo(models.User, {
        foreignKey: { name: 'reviewedBy', allowNull: true },
        as: 'reviewer',
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      });
      LateExcuseRequest.hasOne(models.Attendance, {
        foreignKey: { name: 'lateExcuseRequestId', allowNull: true },
        as: 'attendance',
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      });
    }
  }
  LateExcuseRequest.init({
    userId:       { type: DataTypes.INTEGER, allowNull: false },
    date:         { type: DataTypes.DATEONLY, allowNull: false },
    expectedTime: { type: DataTypes.STRING, allowNull: true },
    reason:       { type: DataTypes.TEXT, allowNull: true },
    status: {
      type: DataTypes.ENUM('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'),
      allowNull: false,
      defaultValue: 'PENDING',
    },
    reviewedBy: { type: DataTypes.INTEGER, allowNull: true },
    reviewedAt: { type: DataTypes.DATE, allowNull: true },
    reviewNote: { type: DataTypes.TEXT, allowNull: true },
    companyId:  { type: DataTypes.INTEGER, allowNull: true },
  }, {
    sequelize,
    modelName: 'LateExcuseRequest',
  });
  return LateExcuseRequest;
};
