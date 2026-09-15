'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class TaskComment extends Model {
    static associate(models) {
      TaskComment.belongsTo(models.Task, {
        foreignKey: { name: 'taskId', allowNull: false },
        as: 'task',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      });
      TaskComment.belongsTo(models.User, {
        foreignKey: { name: 'userId', allowNull: false },
        as: 'user',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      });
    }
  }
  TaskComment.init({
    taskId:  { type: DataTypes.INTEGER, allowNull: false },
    userId:  { type: DataTypes.INTEGER, allowNull: false },
    content: { type: DataTypes.TEXT, allowNull: false },
  }, {
    sequelize,
    modelName: 'TaskComment',
  });
  return TaskComment;
};
