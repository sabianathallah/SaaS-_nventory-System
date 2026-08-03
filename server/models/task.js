'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Task extends Model {
    static associate(models) {
      Task.belongsToMany(models.User, {
        through: models.TaskAssignee,
        foreignKey: 'taskId',
        otherKey: 'userId',
        as: 'assignees',
      });
      Task.hasMany(models.TaskAssignee, {
        foreignKey: { name: 'taskId', allowNull: false },
        as: 'assigneeLinks',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      });
      Task.belongsTo(models.User, {
        foreignKey: { name: 'createdBy', allowNull: false },
        as: 'creator',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      });
      Task.hasMany(models.TaskComment, {
        foreignKey: { name: 'taskId', allowNull: false },
        as: 'comments',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      });
      Task.hasMany(models.TaskAttachment, {
        foreignKey: { name: 'taskId', allowNull: false },
        as: 'attachments',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      });
      Task.belongsTo(models.Task, {
        foreignKey: { name: 'parentTaskId', allowNull: true },
        as: 'parentTask',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      });
      Task.hasMany(models.Task, {
        foreignKey: { name: 'parentTaskId', allowNull: true },
        as: 'subTasks',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      });
      Task.belongsTo(models.TaskList, {
        foreignKey: { name: 'listId', allowNull: true },
        as: 'list',
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      });
    }
  }
  Task.init({
    companyId:   { type: DataTypes.INTEGER, allowNull: true },
    title:       { type: DataTypes.STRING(255), allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
    status: {
      type: DataTypes.ENUM('TODO', 'IN_PROGRESS', 'DONE'),
      allowNull: false,
      defaultValue: 'TODO',
    },
    priority: {
      type: DataTypes.ENUM('LOW', 'MEDIUM', 'HIGH'),
      allowNull: false,
      defaultValue: 'MEDIUM',
    },
    dueDate:    { type: DataTypes.DATEONLY, allowNull: true },
    createdBy:  { type: DataTypes.INTEGER, allowNull: false },
    isImportant: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    myDayDate:   { type: DataTypes.DATEONLY, allowNull: true },
    parentTaskId: { type: DataTypes.INTEGER, allowNull: true },
    divisi:         { type: DataTypes.STRING(100), allowNull: true },
    listId:         { type: DataTypes.INTEGER, allowNull: true },
    tags:           { type: DataTypes.JSON, allowNull: false, defaultValue: [] },
    reminderAt:     { type: DataTypes.DATE, allowNull: true },
    reminderSentAt: { type: DataTypes.DATE, allowNull: true },
    completedAt:    { type: DataTypes.DATE, allowNull: true },
    recurrence: {
      type: DataTypes.ENUM('NONE', 'DAILY', 'WEEKLY', 'MONTHLY'),
      allowNull: false,
      defaultValue: 'NONE',
    },
  }, {
    sequelize,
    modelName: 'Task',
  });
  return Task;
};
