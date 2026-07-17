'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Request extends Model {
    static associate(models) {
      Request.belongsTo(models.RequestType, { foreignKey: 'requestTypeId', as: 'requestType' });
      Request.belongsTo(models.User, { foreignKey: 'requestorId', as: 'requestor' });
      Request.belongsTo(models.User, { foreignKey: 'processedBy', as: 'processor' });
      Request.belongsTo(models.User, { foreignKey: 'updatedBy',   as: 'updater' });
      Request.hasMany(models.RequestItem, { foreignKey: 'requestId', as: 'items' });
      Request.belongsTo(models.ManualShipment, { foreignKey: 'manualShipmentId', as: 'manualShipment' });
      Request.belongsTo(models.Stock_Out_Draft, { foreignKey: 'stockOutDraftId', as: 'stockOutDraft' });
    }
  }
  Request.init({
    requestTypeId:    { type: DataTypes.INTEGER, allowNull: false },
    requestorId:      { type: DataTypes.INTEGER, allowNull: false },
    divisi:           { type: DataTypes.STRING(100), allowNull: true },
    recipientName:    { type: DataTypes.STRING(200), allowNull: true },
    recipientPhone:   { type: DataTypes.STRING(30),  allowNull: true },
    recipientAddress: { type: DataTypes.TEXT, allowNull: true },
    neededAt:         { type: DataTypes.DATEONLY, allowNull: true },
    note:             { type: DataTypes.TEXT, allowNull: true },
    status: {
      type: DataTypes.ENUM('DRAFT','PENDING','APPROVED','REJECTED','SENT','DONE'),
      allowNull: false,
      defaultValue: 'PENDING',
    },
    needsReturn:     { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    sentAt:          { type: DataTypes.DATEONLY, allowNull: true },
    trackingNumber:  { type: DataTypes.STRING(200), allowNull: true },
    returnedAt:      { type: DataTypes.DATEONLY, allowNull: true },
    shippingNote:    { type: DataTypes.TEXT, allowNull: true },
    processedBy:      { type: DataTypes.INTEGER, allowNull: true },
    updatedBy:        { type: DataTypes.INTEGER, allowNull: true },
    rejectionReason:  { type: DataTypes.TEXT,    allowNull: true },
    manualShipmentId: { type: DataTypes.INTEGER, allowNull: true },
    stockOutDraftId:  { type: DataTypes.INTEGER, allowNull: true },
    companyId:        { type: DataTypes.INTEGER, allowNull: true },
  }, {
    sequelize,
    modelName: 'Request',
    tableName: 'Requests',
  });
  return Request;
};
