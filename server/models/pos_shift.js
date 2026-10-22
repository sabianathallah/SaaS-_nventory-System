'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class PosShift extends Model {
    static associate(models) {
      PosShift.belongsTo(models.PosEvent, { foreignKey: 'eventId', as: 'event' });
      PosShift.belongsTo(models.User,     { foreignKey: 'cashierId', as: 'Cashier' });
      PosShift.hasMany(models.PosOrder,   { foreignKey: 'shiftId', as: 'orders' });
    }
  }
  PosShift.init({
    companyId:   { type: DataTypes.INTEGER, allowNull: true },
    eventId:     { type: DataTypes.INTEGER, allowNull: false },
    cashierId:   { type: DataTypes.INTEGER, allowNull: true },
    deviceName:  { type: DataTypes.STRING(60), allowNull: true },
    openedAt:    { type: DataTypes.DATE, allowNull: false },
    closedAt:    { type: DataTypes.DATE, allowNull: true },
    openingCash: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    countedCash: { type: DataTypes.INTEGER, allowNull: true },
    note:        { type: DataTypes.TEXT, allowNull: true },
    status:      { type: DataTypes.STRING(10), allowNull: false, defaultValue: 'OPEN' },
  }, { sequelize, modelName: 'PosShift' });
  return PosShift;
};
