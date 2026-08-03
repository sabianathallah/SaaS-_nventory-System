'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Payslip extends Model {
    static associate(models) {
      Payslip.belongsTo(models.User, {
        foreignKey: { name: 'userId', allowNull: false },
        as: 'user',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      });
      Payslip.belongsTo(models.User, {
        foreignKey: { name: 'publishedBy', allowNull: true },
        as: 'publisher',
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      });
      Payslip.belongsTo(models.User, {
        foreignKey: { name: 'createdBy', allowNull: true },
        as: 'creator',
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      });
    }
  }
  Payslip.init({
    userId:      { type: DataTypes.INTEGER, allowNull: false },
    periodStart: { type: DataTypes.DATEONLY, allowNull: false },
    periodEnd:   { type: DataTypes.DATEONLY, allowNull: false },
    paymentDate: { type: DataTypes.DATEONLY, allowNull: false },

    fixedSalary:        { type: DataTypes.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
    allowanceTransport: { type: DataTypes.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
    allowanceMeal:      { type: DataTypes.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
    overtime:           { type: DataTypes.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
    bonus:              { type: DataTypes.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
    otherDeductions:    { type: DataTypes.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
    totalEarnings:      { type: DataTypes.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
    totalDeductions:    { type: DataTypes.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
    netPay:             { type: DataTypes.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },

    status: {
      type: DataTypes.ENUM('DRAFT', 'PUBLISHED'),
      allowNull: false,
      defaultValue: 'DRAFT',
    },
    publishedBy: { type: DataTypes.INTEGER, allowNull: true },
    publishedAt: { type: DataTypes.DATE, allowNull: true },
    createdBy:   { type: DataTypes.INTEGER, allowNull: true },
    companyId:   { type: DataTypes.INTEGER, allowNull: true },
  }, {
    sequelize,
    modelName: 'Payslip',
  });
  return Payslip;
};
