'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Request extends Model {
    static associate(models) {
      Request.belongsTo(models.RequestType, { foreignKey: 'requestTypeId', as: 'requestType' });
      Request.belongsTo(models.User, { foreignKey: 'requestorId', as: 'requestor' });
      Request.belongsTo(models.User, { foreignKey: 'processedBy', as: 'processor' });
      Request.hasMany(models.RequestItem, { foreignKey: 'requestId', as: 'items' });
    }
  }
  Request.init({
    requestTypeId:    { type: DataTypes.INTEGER, allowNull: false },
    requestorId:      { type: DataTypes.INTEGER, allowNull: false },
    divisi:           { type: DataTypes.STRING(100), allowNull: true },
    recipientName:    { type: DataTypes.STRING(200), allowNull: true },
    recipientAddress: { type: DataTypes.TEXT, allowNull: true },
    neededAt:         { type: DataTypes.DATEONLY, allowNull: true },
    note:             { type: DataTypes.TEXT, allowNull: true },
    status: {
      type: DataTypes.ENUM('PENDING','APPROVED','REJECTED','SENT','DONE'),
      allowNull: false,
      defaultValue: 'PENDING',
    },
    needsReturn:     { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    sentAt:          { type: DataTypes.DATEONLY, allowNull: true },
    trackingNumber:  { type: DataTypes.STRING(200), allowNull: true },
    returnedAt:      { type: DataTypes.DATEONLY, allowNull: true },
    processedBy:     { type: DataTypes.INTEGER, allowNull: true },
    rejectionReason: { type: DataTypes.TEXT, allowNull: true },
    companyId:       { type: DataTypes.INTEGER, allowNull: true },
  }, {
    sequelize,
    modelName: 'Request',
    tableName: 'Requests',
  });
  return Request;
};
