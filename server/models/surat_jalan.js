'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class SuratJalan extends Model {
    static associate(models) {
      SuratJalan.belongsTo(models.IncomingGoods, {
        foreignKey: { name: 'IncomingGoodsId', allowNull: false },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      });
      SuratJalan.belongsTo(models.User, {
        foreignKey: { name: 'generatedBy', allowNull: false },
        as: 'generatedByUser',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      });
    }
  }

  SuratJalan.init({
    sjNumber: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: { msg: 'SJ number already exists' },
    },
    IncomingGoodsId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: true,
    },
    generatedBy:   { type: DataTypes.INTEGER,  allowNull: false },
    generatedAt:   { type: DataTypes.DATE,     allowNull: false },
    printedAt:     { type: DataTypes.DATE,     allowNull: true },
    snapshotItems: { type: DataTypes.JSONB,    allowNull: false, defaultValue: [] },
    notes:         { type: DataTypes.TEXT,     allowNull: true },
    companyId:     { type: DataTypes.INTEGER,  allowNull: true },
  }, {
    sequelize,
    modelName: 'SuratJalan',
  });

  return SuratJalan;
};
