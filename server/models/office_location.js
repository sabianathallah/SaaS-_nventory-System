'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class OfficeLocation extends Model {
    static associate(models) {
      OfficeLocation.hasMany(models.Attendance, {
        foreignKey: { name: 'checkInLocationId', allowNull: true },
        as: 'checkIns',
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      });
      OfficeLocation.hasMany(models.Attendance, {
        foreignKey: { name: 'checkOutLocationId', allowNull: true },
        as: 'checkOuts',
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      });
    }
  }
  OfficeLocation.init({
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: { notNull: { msg: 'Name is required' }, notEmpty: { msg: 'Name is required' } },
    },
    address:      { type: DataTypes.TEXT, allowNull: true },
    latitude:     { type: DataTypes.DECIMAL(10, 7), allowNull: false },
    longitude:    { type: DataTypes.DECIMAL(10, 7), allowNull: false },
    radiusMeters: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 150 },
    companyId:    { type: DataTypes.INTEGER, allowNull: true },
  }, {
    sequelize,
    modelName: 'OfficeLocation',
  });
  return OfficeLocation;
};
