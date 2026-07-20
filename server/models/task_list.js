'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class TaskList extends Model {
    static associate(models) {
      TaskList.belongsTo(models.User, {
        foreignKey: { name: 'userId', allowNull: false },
        as: 'user',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      });
      TaskList.hasMany(models.Task, {
        foreignKey: { name: 'listId', allowNull: true },
        as: 'tasks',
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      });
    }
  }
  TaskList.init({
    companyId: { type: DataTypes.INTEGER, allowNull: true },
    userId:    { type: DataTypes.INTEGER, allowNull: false },
    name:      { type: DataTypes.STRING(100), allowNull: false },
    color:     { type: DataTypes.STRING(20), allowNull: false, defaultValue: '#C8102E' },
    icon:      { type: DataTypes.STRING(50), allowNull: true },
  }, {
    sequelize,
    modelName: 'TaskList',
  });
  return TaskList;
};
