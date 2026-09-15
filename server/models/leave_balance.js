'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class LeaveBalance extends Model {
    static associate(models) {
      LeaveBalance.belongsTo(models.User, {
        foreignKey: { name: 'userId', allowNull: false },
        as: 'user',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      });
      LeaveBalance.belongsTo(models.LeaveType, {
        foreignKey: { name: 'leaveTypeId', allowNull: false },
        as: 'leaveType',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      });
    }
  }
  LeaveBalance.init({
    userId:      { type: DataTypes.INTEGER, allowNull: false },
    leaveTypeId: { type: DataTypes.INTEGER, allowNull: false },
    year:        { type: DataTypes.INTEGER, allowNull: false },
    allocated:   { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    used:        { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    companyId:   { type: DataTypes.INTEGER, allowNull: true },
  }, {
    sequelize,
    modelName: 'LeaveBalance',
  });
  return LeaveBalance;
};
