'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class DbLink extends Model {
    static associate(models) {
      DbLink.belongsTo(models.DbFolder, { foreignKey: 'folderId' });
      DbLink.belongsTo(models.User, { foreignKey: 'createdBy', as: 'Creator' });
    }
  }
  DbLink.init({
    title:       { type: DataTypes.STRING(200), allowNull: false },
    url:         { type: DataTypes.TEXT, allowNull: false },
    description: { type: DataTypes.STRING, allowNull: true },
    position:    { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    folderId:    { type: DataTypes.INTEGER, allowNull: false },
    createdBy:   { type: DataTypes.INTEGER, allowNull: false },
  }, { sequelize, modelName: 'DbLink' });
  return DbLink;
};
