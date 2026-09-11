'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class EmployeeDocument extends Model {
    static associate(models) {
      EmployeeDocument.belongsTo(models.User, {
        foreignKey: { name: 'userId', allowNull: false },
        as: 'user',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      });
      EmployeeDocument.belongsTo(models.User, {
        foreignKey: { name: 'uploadedBy', allowNull: false },
        as: 'uploader',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      });
    }
  }
  EmployeeDocument.init({
    userId:     { type: DataTypes.INTEGER, allowNull: false },
    companyId:  { type: DataTypes.INTEGER, allowNull: true },
    uploadedBy: { type: DataTypes.INTEGER, allowNull: false },
    type: {
      type: DataTypes.ENUM('KTP', 'NPWP', 'CONTRACT', 'OTHER'),
      allowNull: false,
    },
    title:      { type: DataTypes.STRING(255), allowNull: false },
    url:        { type: DataTypes.TEXT, allowNull: false },
    expiryDate: { type: DataTypes.DATEONLY, allowNull: true },
    note:       { type: DataTypes.TEXT, allowNull: true },
    expiryReminderSentAt: { type: DataTypes.DATE, allowNull: true },
  }, {
    sequelize,
    modelName: 'EmployeeDocument',
  });
  return EmployeeDocument;
};
