'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class ManualShipment extends Model {
    static associate(models) {
      ManualShipment.belongsTo(models.ShipmentCategory, { foreignKey: 'shipmentCategoryId', as: 'category' });
      ManualShipment.belongsTo(models.User, { foreignKey: 'createdBy',              as: 'creator' });
      ManualShipment.belongsTo(models.User, { foreignKey: 'updatedBy',              as: 'updater' });
      ManualShipment.belongsTo(models.User, { foreignKey: 'submittedBy',            as: 'submitter' });
      ManualShipment.belongsTo(models.User, { foreignKey: 'paymentProofVerifiedBy', as: 'paymentVerifier' });
      ManualShipment.hasMany(models.ManualShipmentItem, { foreignKey: 'shipmentId', as: 'items' });
      ManualShipment.belongsTo(models.Request, { foreignKey: 'sourceRequestId', as: 'sourceRequest' });
    }
  }
  ManualShipment.init({
    companyId:              { type: DataTypes.INTEGER,     allowNull: true },
    invoiceNumber:          { type: DataTypes.STRING(30),  allowNull: false, unique: true },
    type:                   { type: DataTypes.ENUM('sales', 'non_sales'), allowNull: false },
    shipmentCategoryId:     { type: DataTypes.INTEGER,     allowNull: true },
    status:                 { type: DataTypes.ENUM('draft', 'pending', 'paid', 'shipped', 'completed', 'cancelled'), allowNull: false, defaultValue: 'draft' },
    buyerName:              { type: DataTypes.STRING(150), allowNull: true },
    buyerAddress:           { type: DataTypes.TEXT,        allowNull: true },
    buyerPhone:             { type: DataTypes.STRING(30),  allowNull: true },
    recipientInfo:          { type: DataTypes.TEXT,        allowNull: true },
    recipientName:          { type: DataTypes.STRING(150), allowNull: true },
    recipientAddress:       { type: DataTypes.TEXT,        allowNull: true },
    recipientPhone:         { type: DataTypes.STRING(30),  allowNull: true },
    shippingCost:           { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
    subtotal:               { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
    total:                  { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
    paymentProofUrls:       { type: DataTypes.JSONB,       allowNull: false, defaultValue: [] },
    paymentProofVerifiedBy: { type: DataTypes.INTEGER,     allowNull: true },
    paymentProofVerifiedAt: { type: DataTypes.DATE,        allowNull: true },
    expeditionName:         { type: DataTypes.STRING(100), allowNull: true },
    courierResiNumber:      { type: DataTypes.STRING(100), allowNull: true },
    courierResiImageUrl:    { type: DataTypes.TEXT,        allowNull: true },
    notes:                  { type: DataTypes.TEXT,        allowNull: true },
    cancelledReason:        { type: DataTypes.TEXT,        allowNull: true },
    resiPrintedAt:          { type: DataTypes.DATE,        allowNull: true },
    invoicePrintedAt:       { type: DataTypes.DATE,        allowNull: true },
    sourceRequestId:        { type: DataTypes.INTEGER,     allowNull: true },
    itemsModifiedFromSource:{ type: DataTypes.BOOLEAN,     allowNull: false, defaultValue: false },
    skippedStockOut:        { type: DataTypes.BOOLEAN,     allowNull: false, defaultValue: false },
    createdBy:              { type: DataTypes.INTEGER,     allowNull: true },
    updatedBy:              { type: DataTypes.INTEGER,     allowNull: true },
    submittedBy:            { type: DataTypes.INTEGER,     allowNull: true },
  }, { sequelize, modelName: 'ManualShipment' });
  return ManualShipment;
};
