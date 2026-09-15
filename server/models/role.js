'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Role extends Model {
    static associate(models) {
      Role.belongsTo(models.Company, { foreignKey: 'companyId', as: 'company', onDelete: 'CASCADE', onUpdate: 'CASCADE' });
      Role.hasMany(models.RolePermission, { foreignKey: 'roleId', as: 'rolePermissions', onDelete: 'CASCADE' });
    }
  }
  Role.init({
    name:        { type: DataTypes.STRING(100), allowNull: false },
    displayName: { type: DataTypes.STRING(200), allowNull: false },
    companyId:   { type: DataTypes.INTEGER, allowNull: true },
    isSystem:    { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  }, { sequelize, modelName: 'Role' });
  return Role;
};
