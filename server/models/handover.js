'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Handover extends Model {
    static associate(models) {
      Handover.belongsTo(models.User, {
        foreignKey: { name: 'createdBy', allowNull: false },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      });
      Handover.hasMany(models.Handover_Item, {
        foreignKey: 'HandoverId',
        onDelete: 'CASCADE',
      });
    }
  }
  Handover.init({
    ekspedisi:  { type: DataTypes.STRING(100), allowNull: false },
    date:       { type: DataTypes.DATEONLY,    allowNull: false },
    note:       { type: DataTypes.STRING,      allowNull: true },
    status:     { type: DataTypes.STRING(10), allowNull: false, defaultValue: 'OPEN' },
    createdBy:  { type: DataTypes.INTEGER,     allowNull: false },
    companyId:  { type: DataTypes.INTEGER,     allowNull: true },
  }, { sequelize, modelName: 'Handover' });
  return Handover;
};
