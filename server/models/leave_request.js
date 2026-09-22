'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class LeaveRequest extends Model {
    static associate(models) {
      LeaveRequest.belongsTo(models.User, {
        foreignKey: { name: 'userId', allowNull: false },
        as: 'user',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      });
      LeaveRequest.belongsTo(models.LeaveType, {
        foreignKey: { name: 'leaveTypeId', allowNull: false },
        as: 'leaveType',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      });
      LeaveRequest.belongsTo(models.User, {
        foreignKey: { name: 'reviewedBy', allowNull: true },
        as: 'reviewer',
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      });
    }
  }
  LeaveRequest.init({
    userId:      { type: DataTypes.INTEGER, allowNull: false },
    leaveTypeId: { type: DataTypes.INTEGER, allowNull: false },
    startDate:   { type: DataTypes.DATEONLY, allowNull: false },
    endDate:     { type: DataTypes.DATEONLY, allowNull: false },
    days:        { type: DataTypes.INTEGER, allowNull: false },
    reason:      { type: DataTypes.TEXT, allowNull: true },
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
    modelName: 'LeaveRequest',
  });
  return LeaveRequest;
};
