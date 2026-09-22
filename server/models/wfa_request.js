'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class WfaRequest extends Model {
    static associate(models) {
      WfaRequest.belongsTo(models.User, {
        foreignKey: { name: 'userId', allowNull: false },
        as: 'user',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      });
      WfaRequest.belongsTo(models.User, {
        foreignKey: { name: 'reviewedBy', allowNull: true },
        as: 'reviewer',
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      });
      WfaRequest.hasOne(models.PaymentAdjustment, {
        foreignKey: { name: 'wfaRequestId', allowNull: true },
        as: 'paymentAdjustment',
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      });
    }
  }
  WfaRequest.init({
    userId:      { type: DataTypes.INTEGER, allowNull: false },
    date:        { type: DataTypes.DATEONLY, allowNull: false },
    reason:      { type: DataTypes.TEXT, allowNull: true },
    isOverQuota: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
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
    modelName: 'WfaRequest',
  });
  return WfaRequest;
};
