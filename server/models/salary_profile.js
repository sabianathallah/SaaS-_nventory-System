'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class SalaryProfile extends Model {
    static associate(models) {
      SalaryProfile.belongsTo(models.User, {
        foreignKey: { name: 'userId', allowNull: false },
        as: 'user',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      });
    }
  }
  SalaryProfile.init({
    userId:             { type: DataTypes.INTEGER, allowNull: false, unique: true },
    fixedSalary:        { type: DataTypes.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
    allowanceTransport: { type: DataTypes.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
    allowanceMeal:      { type: DataTypes.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
    companyId:          { type: DataTypes.INTEGER, allowNull: true },
  }, {
    sequelize,
    modelName: 'SalaryProfile',
  });
  return SalaryProfile;
};
