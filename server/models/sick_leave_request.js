'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class SickLeaveRequest extends Model {
    static associate(models) {
      SickLeaveRequest.belongsTo(models.User, {
        foreignKey: { name: 'userId', allowNull: false },
        as: 'user',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      });
      SickLeaveRequest.belongsTo(models.User, {
        foreignKey: { name: 'reviewedBy', allowNull: true },
        as: 'reviewer',
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      });
    }
  }
  SickLeaveRequest.init({
    userId:        { type: DataTypes.INTEGER, allowNull: false },
    date:          { type: DataTypes.DATEONLY, allowNull: false },
    reason:        { type: DataTypes.TEXT, allowNull: false },
    attachmentUrl: { type: DataTypes.STRING, allowNull: true },
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
    modelName: 'SickLeaveRequest',
  });
  return SickLeaveRequest;
};
