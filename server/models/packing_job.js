'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class PackingJob extends Model {
    static associate(models) {
      PackingJob.belongsTo(models.IncomingGoods, {
        foreignKey: { name: 'IncomingGoodsId', allowNull: false },
        as: 'incomingGoods',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      });
      PackingJob.belongsTo(models.User, {
        foreignKey: { name: 'assignedTo', allowNull: false },
        as: 'assignedToUser',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      });
      PackingJob.belongsTo(models.User, {
        foreignKey: { name: 'assignedBy', allowNull: false },
        as: 'assignedByUser',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      });
      PackingJob.belongsTo(models.User, {
        foreignKey: { name: 'verifiedBy', allowNull: true },
        as: 'verifiedByUser',
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      });
      PackingJob.hasMany(models.PackingResult, {
        foreignKey: { name: 'PackingJobId', allowNull: false },
        as: 'results',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      });
      PackingJob.hasOne(models.FormAnakPacking, {
        foreignKey: { name: 'PackingJobId', allowNull: false },
        as: 'formAnakPacking',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      });
    }
  }

  PackingJob.init({
    IncomingGoodsId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: { notNull: { msg: 'IncomingGoods is required' } },
    },
    assignedTo: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: { notNull: { msg: 'Assigned to is required' } },
    },
    assignedBy: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: { notNull: { msg: 'Assigned by is required' } },
    },
    assignedAt:  { type: DataTypes.DATE, allowNull: false },
    status: {
      type: DataTypes.ENUM('PENDING','IN_PROGRESS','SUBMITTED','VERIFIED'),
      allowNull: false,
      defaultValue: 'PENDING',
    },
    startedAt:   { type: DataTypes.DATE,    allowNull: true },
    submittedAt: { type: DataTypes.DATE,    allowNull: true },
    verifiedAt:  { type: DataTypes.DATE,    allowNull: true },
    verifiedBy:  { type: DataTypes.INTEGER, allowNull: true },
    notes:       { type: DataTypes.TEXT,    allowNull: true },
    companyId:   { type: DataTypes.INTEGER, allowNull: true },
  }, {
    sequelize,
    modelName: 'PackingJob',
  });

  return PackingJob;
};
