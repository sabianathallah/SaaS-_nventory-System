'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class TaskAttachment extends Model {
    static associate(models) {
      TaskAttachment.belongsTo(models.Task, {
        foreignKey: { name: 'taskId', allowNull: false },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      });
      TaskAttachment.belongsTo(models.User, {
        foreignKey: { name: 'userId', allowNull: false },
        as: 'user',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      });
    }
  }
  TaskAttachment.init({
    taskId:  { type: DataTypes.INTEGER, allowNull: false },
    userId:  { type: DataTypes.INTEGER, allowNull: false },
    type:    { type: DataTypes.ENUM('IMAGE', 'VIDEO_LINK', 'DOCUMENT'), allowNull: false },
    url:     { type: DataTypes.TEXT, allowNull: false },
    caption: { type: DataTypes.STRING(255), allowNull: true },
  }, {
    sequelize,
    modelName: 'TaskAttachment',
  });
  return TaskAttachment;
};
