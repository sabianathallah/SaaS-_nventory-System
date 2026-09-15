'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class VendorDeliveryLog extends Model {
    static associate(models) {
      VendorDeliveryLog.belongsTo(models.VendorDelivery, { foreignKey: 'deliveryId' });
      VendorDeliveryLog.belongsTo(models.User, { foreignKey: 'userId', as: 'User' });
    }
  }
  VendorDeliveryLog.init({
    deliveryId:  { type: DataTypes.INTEGER, allowNull: false },
    userId:      { type: DataTypes.INTEGER, allowNull: true },
    action:      { type: DataTypes.STRING(30), allowNull: false },
    description: { type: DataTypes.STRING(255), allowNull: true },
  }, { sequelize, modelName: 'VendorDeliveryLog' });
  return VendorDeliveryLog;
};
