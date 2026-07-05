'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Shift extends Model {
    static associate(models) {
      Shift.hasMany(models.Attendance, {
        foreignKey: { name: 'shiftId', allowNull: true },
        as: 'attendances',
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      });
    }
  }
  Shift.init({
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: { notNull: { msg: 'Name is required' }, notEmpty: { msg: 'Name is required' } },
    },
    startTime: { type: DataTypes.TIME, allowNull: false },
    endTime:   { type: DataTypes.TIME, allowNull: false },
    companyId: { type: DataTypes.INTEGER, allowNull: true },
  }, {
    sequelize,
    modelName: 'Shift',
  });
  return Shift;
};
