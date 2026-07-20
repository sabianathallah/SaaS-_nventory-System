'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Task extends Model {
    static associate(models) {
      Task.belongsTo(models.User, {
        foreignKey: { name: 'assigneeId', allowNull: true },
        as: 'assignee',
        onDelete: 'SET NULL',
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
    assigneeId: { type: DataTypes.INTEGER, allowNull: true },
    createdBy:  { type: DataTypes.INTEGER, allowNull: false },
    isImportant: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    myDayDate:   { type: DataTypes.DATEONLY, allowNull: true },
  }, {
    sequelize,
    modelName: 'Task',
  });
  return Task;
};
