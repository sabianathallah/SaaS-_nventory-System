'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class PackingResult extends Model {
    static associate(models) {
      PackingResult.belongsTo(models.PackingJob, {
        foreignKey: { name: 'PackingJobId', allowNull: false },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      });
      PackingResult.belongsTo(models.IncomingGoodsItem, {
        foreignKey: { name: 'IncomingGoodsItemId', allowNull: false },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      });
      PackingResult.belongsTo(models.User, {
        foreignKey: { name: 'submittedBy', allowNull: false },
        as: 'submittedByUser',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      });
    }
  }

  PackingResult.init({
    PackingJobId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: { notNull: { msg: 'PackingJob is required' } },
    },
    IncomingGoodsItemId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: { notNull: { msg: 'IncomingGoodsItem is required' } },
    },
    qtyReady: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: { min: { args: [0], msg: 'qtyReady cannot be negative' } },
    },
    qtyReject: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: { min: { args: [0], msg: 'qtyReject cannot be negative' } },
    },
    rejectReason:   { type: DataTypes.TEXT,        allowNull: true },
    scannedBarcode: { type: DataTypes.STRING(255),  allowNull: true },
    submittedBy:    { type: DataTypes.INTEGER,      allowNull: false },
    companyId:      { type: DataTypes.INTEGER,      allowNull: true },
  }, {
    sequelize,
    modelName: 'PackingResult',
  });

  return PackingResult;
};
