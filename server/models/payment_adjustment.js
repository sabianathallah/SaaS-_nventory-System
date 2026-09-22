'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class PaymentAdjustment extends Model {
    static associate(models) {
      PaymentAdjustment.belongsTo(models.User, {
        foreignKey: { name: 'userId', allowNull: false },
        as: 'user',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      });
      PaymentAdjustment.belongsTo(models.WfaRequest, {
        foreignKey: { name: 'wfaRequestId', allowNull: true },
        as: 'wfaRequest',
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      });
      PaymentAdjustment.belongsTo(models.User, {
        foreignKey: { name: 'createdBy', allowNull: false },
        as: 'creator',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      });
    }
  }
  PaymentAdjustment.init({
    userId:       { type: DataTypes.INTEGER, allowNull: false },
    wfaRequestId: { type: DataTypes.INTEGER, allowNull: true },
    type:         { type: DataTypes.STRING(50), allowNull: false, defaultValue: 'WFA_OVERQUOTA' },
    month:        { type: DataTypes.INTEGER, allowNull: false },
    year:         { type: DataTypes.INTEGER, allowNull: false },
    amount:       { type: DataTypes.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
    note:         { type: DataTypes.TEXT, allowNull: true },
    createdBy:    { type: DataTypes.INTEGER, allowNull: false },
    companyId:    { type: DataTypes.INTEGER, allowNull: true },
  }, {
    sequelize,
    modelName: 'PaymentAdjustment',
  });
  return PaymentAdjustment;
};
