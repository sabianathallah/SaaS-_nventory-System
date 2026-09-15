'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class RolePermission extends Model {
    static associate(models) {
      RolePermission.belongsTo(models.Role, { foreignKey: 'roleId', as: 'role' });
    }
  }
  RolePermission.init({
    roleId:        { type: DataTypes.INTEGER, allowNull: false },
    permissionKey: { type: DataTypes.STRING(100), allowNull: false },
  }, { sequelize, modelName: 'RolePermission' });
  return RolePermission;
};
