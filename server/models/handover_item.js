'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Handover_Item extends Model {
    static associate(models) {
      Handover_Item.belongsTo(models.Handover, {
        foreignKey: { name: 'HandoverId', allowNull: false },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      });
    }
  }
  Handover_Item.init({
    HandoverId:  { type: DataTypes.INTEGER, allowNull: false },
    resi:        { type: DataTypes.STRING(200), allowNull: false },
    scannedAt:   { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    companyId:   { type: DataTypes.INTEGER, allowNull: true },
  }, { sequelize, modelName: 'Handover_Item' });
  return Handover_Item;
};
