'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class LeaveType extends Model {
    static associate(models) {
      LeaveType.hasMany(models.LeaveBalance, {
        foreignKey: { name: 'leaveTypeId', allowNull: false },
        as: 'leaveBalances',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      });
      LeaveType.hasMany(models.LeaveRequest, {
        foreignKey: { name: 'leaveTypeId', allowNull: false },
        as: 'leaveRequests',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      });
    }
  }
  LeaveType.init({
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: { notNull: { msg: 'Name is required' }, notEmpty: { msg: 'Name is required' } },
    },
    maxDaysPerYear: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 12 },
    companyId:      { type: DataTypes.INTEGER, allowNull: true },
  }, {
    sequelize,
    modelName: 'LeaveType',
  });
  return LeaveType;
};
