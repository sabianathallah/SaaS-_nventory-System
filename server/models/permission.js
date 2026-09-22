'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Permission extends Model {
    static associate() {}
  }
  Permission.init({
    key:   { type: DataTypes.STRING(100), allowNull: false, unique: true },
    label: { type: DataTypes.STRING(200), allowNull: false },
    group: { type: DataTypes.STRING(100), allowNull: false },
  }, { sequelize, modelName: 'Permission' });
  return Permission;
};
