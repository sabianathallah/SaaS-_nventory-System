'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Project extends Model {
    static associate(models) {
      Project.belongsTo(models.User, {
        foreignKey: { name: 'ownerId', allowNull: true },
        as: 'owner',
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      });
      Project.belongsTo(models.User, {
        foreignKey: { name: 'createdBy', allowNull: false },
        as: 'creator',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      });
      Project.hasMany(models.Task, {
        foreignKey: { name: 'projectId', allowNull: true },
        as: 'tasks',
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      });
    }
  }
  Project.init({
    companyId:   { type: DataTypes.INTEGER, allowNull: true },
    name:        { type: DataTypes.STRING(150), allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
    color:       { type: DataTypes.STRING(20), allowNull: false, defaultValue: '#C8102E' },
    icon:        { type: DataTypes.STRING(50), allowNull: true },
    status: {
      type: DataTypes.ENUM('PLANNING', 'ACTIVE', 'ON_HOLD', 'DONE'),
      allowNull: false,
      defaultValue: 'ACTIVE',
    },
    startDate: { type: DataTypes.DATEONLY, allowNull: true },
    dueDate:   { type: DataTypes.DATEONLY, allowNull: true },
    ownerId:   { type: DataTypes.INTEGER, allowNull: true },
    createdBy: { type: DataTypes.INTEGER, allowNull: false },
  }, {
    sequelize,
    modelName: 'Project',
  });
  return Project;
};
