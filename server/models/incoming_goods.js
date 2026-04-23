'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class IncomingGoods extends Model {
    static associate(models) {
      IncomingGoods.belongsTo(models.Vendor, {
        foreignKey: { name: 'VendorId', allowNull: false },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      });
      IncomingGoods.belongsTo(models.User, {
        foreignKey: { name: 'receivedBy', allowNull: false },
        as: 'receivedByUser',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      });
      IncomingGoods.hasMany(models.IncomingGoodsItem, {
        foreignKey: { name: 'IncomingGoodsId', allowNull: false },
        as: 'items',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      });
      IncomingGoods.hasOne(models.SuratJalan, {
        foreignKey: { name: 'IncomingGoodsId', allowNull: false },
        as: 'suratJalan',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      });
      IncomingGoods.hasMany(models.PackingJob, {
        foreignKey: { name: 'IncomingGoodsId', allowNull: false },
        as: 'packingJobs',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      });
    }
  }

  IncomingGoods.init({
    docNumber: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: { msg: 'Doc number already exists' },
    },
    VendorId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: { notNull: { msg: 'Vendor is required' } },
    },
    receivedBy: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: { notNull: { msg: 'Received by is required' } },
    },
    receivedDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      validate: { notNull: { msg: 'Received date is required' } },
    },
    vendorDeliveryNote: { type: DataTypes.STRING(255), allowNull: true },
    status: {
      type: DataTypes.ENUM('DRAFT','VENDOR_CONFIRMED','PRODUCTION_NOTIFIED','PACKING_IN_PROGRESS','COMPLETED'),
      allowNull: false,
      defaultValue: 'DRAFT',
    },
    totalItems: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    totalQty:   { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    notes:                { type: DataTypes.TEXT, allowNull: true },
    vendorConfirmedAt:    { type: DataTypes.DATE, allowNull: true },
    productionNotifiedAt: { type: DataTypes.DATE, allowNull: true },
    completedAt:          { type: DataTypes.DATE, allowNull: true },
    companyId:            { type: DataTypes.INTEGER, allowNull: true },
  }, {
    sequelize,
    modelName: 'IncomingGoods',
  });

  return IncomingGoods;
};
