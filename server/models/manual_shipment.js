'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class ManualShipment extends Model {
    static associate(models) {
      ManualShipment.belongsTo(models.ShipmentCategory, { foreignKey: 'shipmentCategoryId', as: 'category' });
      ManualShipment.belongsTo(models.User, { foreignKey: 'createdBy',              as: 'creator' });
      ManualShipment.belongsTo(models.User, { foreignKey: 'paymentProofVerifiedBy', as: 'paymentVerifier' });
      ManualShipment.hasMany(models.ManualShipmentItem, { foreignKey: 'shipmentId', as: 'items' });
    }
  }
  ManualShipment.init({
    companyId:              { type: DataTypes.INTEGER,     allowNull: true },
    invoiceNumber:          { type: DataTypes.STRING(30),  allowNull: false, unique: true },
    type:                   { type: DataTypes.ENUM('sales', 'non_sales'), allowNull: false },
    shipmentCategoryId:     { type: DataTypes.INTEGER,     allowNull: true },
    status:                 { type: DataTypes.ENUM('in_progress', 'transferred', 'shipped', 'completed', 'cancelled'), allowNull: false, defaultValue: 'in_progress' },
    buyerName:              { type: DataTypes.STRING(150), allowNull: true },
    buyerAddress:           { type: DataTypes.TEXT,        allowNull: true },
    buyerPhone:             { type: DataTypes.STRING(30),  allowNull: true },
    recipientInfo:          { type: DataTypes.TEXT,        allowNull: true },
    shippingCost:           { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
    subtotal:               { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
    total:                  { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
    paymentProofUrl:        { type: DataTypes.TEXT,        allowNull: true },
    paymentProofVerifiedBy: { type: DataTypes.INTEGER,     allowNull: true },
    paymentProofVerifiedAt: { type: DataTypes.DATE,        allowNull: true },
    expeditionName:         { type: DataTypes.STRING(100), allowNull: true },
    courierResiNumber:      { type: DataTypes.STRING(100), allowNull: true },
    courierResiImageUrl:    { type: DataTypes.TEXT,        allowNull: true },
    notes:                  { type: DataTypes.TEXT,        allowNull: true },
    cancelledReason:        { type: DataTypes.TEXT,        allowNull: true },
    createdBy:              { type: DataTypes.INTEGER,     allowNull: true },
  }, { sequelize, modelName: 'ManualShipment' });
  return ManualShipment;
};
