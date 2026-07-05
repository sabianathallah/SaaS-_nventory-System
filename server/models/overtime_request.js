'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class OvertimeRequest extends Model {
    static associate(models) {
      OvertimeRequest.belongsTo(models.User, {
        foreignKey: { name: 'userId', allowNull: false },
        as: 'user',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      });
      OvertimeRequest.belongsTo(models.Attendance, {
        foreignKey: { name: 'attendanceId', allowNull: true },
        as: 'attendance',
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      });
      OvertimeRequest.belongsTo(models.User, {
        foreignKey: { name: 'reviewedBy', allowNull: true },
        as: 'reviewer',
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      });
    }
  }
  OvertimeRequest.init({
    userId:       { type: DataTypes.INTEGER, allowNull: false },
    attendanceId: { type: DataTypes.INTEGER, allowNull: true },
    date:         { type: DataTypes.DATEONLY, allowNull: false },
    startTime:    { type: DataTypes.TIME, allowNull: false },
    endTime:      { type: DataTypes.TIME, allowNull: false },
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
    modelName: 'OvertimeRequest',
  });
  return OvertimeRequest;
};
