'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class ShipmentCategory extends Model {
    static associate(models) {
      ShipmentCategory.hasMany(models.ManualShipment, { foreignKey: 'shipmentCategoryId', as: 'shipments' });
    }
  }
  ShipmentCategory.init({
    companyId: { type: DataTypes.INTEGER, allowNull: true },
    name:      { type: DataTypes.STRING(100), allowNull: false },
  }, { sequelize, modelName: 'ShipmentCategory' });
  return ShipmentCategory;
};
