'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class RolePermission extends Model {
    static associate(models) {
      RolePermission.belongsTo(models.Company, {
        foreignKey: 'companyId',
        as: 'company',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      });
    }
  }
  RolePermission.init({
    role: { type: DataTypes.STRING, allowNull: false },
    permissions: { type: DataTypes.JSON, allowNull: false, defaultValue: [] },
    companyId: { type: DataTypes.INTEGER, allowNull: true },
  }, {
    sequelize,
    modelName: 'RolePermission',
  });
  return RolePermission;
};
