'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class FormAnakPacking extends Model {
    static associate(models) {
      FormAnakPacking.belongsTo(models.PackingJob, {
        foreignKey: { name: 'PackingJobId', allowNull: false },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      });
      FormAnakPacking.belongsTo(models.User, {
        foreignKey: { name: 'workerId', allowNull: false },
        as: 'worker',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      });
      FormAnakPacking.belongsTo(models.User, {
        foreignKey: { name: 'generatedBy', allowNull: false },
        as: 'generatedByUser',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      });
    }
  }

  FormAnakPacking.init({
    formNumber: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: { msg: 'Form number already exists' },
    },
    PackingJobId:    { type: DataTypes.INTEGER, allowNull: false, unique: true },
    workerId:        { type: DataTypes.INTEGER, allowNull: false },
    totalQtyPacked:  { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    totalQtyReady:   { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    totalQtyReject:  { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    snapshotResults: { type: DataTypes.JSONB,   allowNull: false, defaultValue: [] },
    generatedBy:     { type: DataTypes.INTEGER, allowNull: false },
    generatedAt:     { type: DataTypes.DATE,    allowNull: false },
    companyId:       { type: DataTypes.INTEGER, allowNull: true },
  }, {
    sequelize,
    modelName: 'FormAnakPacking',
  });

  return FormAnakPacking;
};
