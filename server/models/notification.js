'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Notification extends Model {
    static associate(models) {
      Notification.belongsTo(models.User, {
        foreignKey: { name: 'userId', allowNull: false },
        as: 'user',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      });
    }
  }
  Notification.init({
    companyId: { type: DataTypes.INTEGER, allowNull: true },
    userId:    { type: DataTypes.INTEGER, allowNull: false },
    type:      { type: DataTypes.STRING(50), allowNull: false },
    title:     { type: DataTypes.STRING(255), allowNull: false },
    message:   { type: DataTypes.STRING(500), allowNull: false },
    link:      { type: DataTypes.STRING(255), allowNull: true },
    isRead:    { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  }, {
    sequelize,
    modelName: 'Notification',
  });
  return Notification;
};
