'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class DbFolder extends Model {
    static associate(models) {
      DbFolder.belongsTo(models.User, { foreignKey: 'createdBy', as: 'Creator' });
      DbFolder.hasMany(models.DbLink, { foreignKey: 'folderId', as: 'links', onDelete: 'CASCADE' });
    }
  }
  DbFolder.init({
    name:        { type: DataTypes.STRING(100), allowNull: false },
    color:       { type: DataTypes.STRING(20), allowNull: false, defaultValue: '#6366f1' },
    description: { type: DataTypes.STRING, allowNull: true },
    position:    { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    createdBy:   { type: DataTypes.INTEGER, allowNull: false },
  }, { sequelize, modelName: 'DbFolder' });
  return DbFolder;
};
