'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class TaskAssignee extends Model {
    static associate(models) {
      TaskAssignee.belongsTo(models.Task, {
        foreignKey: { name: 'taskId', allowNull: false },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      });
      TaskAssignee.belongsTo(models.User, {
        foreignKey: { name: 'userId', allowNull: false },
        as: 'user',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      });
    }
  }
  TaskAssignee.init({
    taskId: { type: DataTypes.INTEGER, allowNull: false },
    userId: { type: DataTypes.INTEGER, allowNull: false },
    assignmentStatus: {
      type: DataTypes.ENUM('PENDING', 'ACCEPTED', 'REJECTED'),
      allowNull: true,
    },
    assignmentNote: { type: DataTypes.TEXT, allowNull: true },
  }, {
    sequelize,
    modelName: 'TaskAssignee',
  });
  return TaskAssignee;
};
