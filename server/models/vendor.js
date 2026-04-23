'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Vendor extends Model {
    static associate(models) {
      Vendor.hasMany(models.IncomingGoods, {
        foreignKey: { name: 'VendorId', allowNull: false },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      });
    }
  }

  Vendor.init({
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: { notNull: { msg: 'Name is required' }, notEmpty: { msg: 'Name is required' } },
    },
    vendorCode: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: { msg: 'Vendor code already exists' },
      validate: { notNull: { msg: 'Vendor code is required' }, notEmpty: { msg: 'Vendor code is required' } },
    },
    contact:   { type: DataTypes.STRING(255), allowNull: true },
    phone:     { type: DataTypes.STRING(50),  allowNull: true },
    email:     { type: DataTypes.STRING(255), allowNull: true },
    address:   { type: DataTypes.TEXT,        allowNull: true },
    companyId: { type: DataTypes.INTEGER,     allowNull: true },
  }, {
    sequelize,
    modelName: 'Vendor',
  });

  return Vendor;
};
