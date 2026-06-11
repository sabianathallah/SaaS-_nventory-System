'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class VendorDelivery extends Model {
    static associate(models) {
      VendorDelivery.belongsTo(models.Vendor, { foreignKey: 'vendorId', as: 'Vendor' });
      VendorDelivery.belongsTo(models.User,   { foreignKey: 'createdBy', as: 'Creator' });
      VendorDelivery.hasMany(models.VendorDeliveryItem, { foreignKey: 'deliveryId', as: 'items', onDelete: 'CASCADE' });
    }
  }
  VendorDelivery.init({
    vendorId:  { type: DataTypes.INTEGER, allowNull: false },
    date:      { type: DataTypes.DATEONLY, allowNull: false },
    sjNumber:  { type: DataTypes.STRING, allowNull: true },
    sjPhotos:  { type: DataTypes.JSON,   allowNull: true },
    videoLink: { type: DataTypes.TEXT, allowNull: true },
    notes:     { type: DataTypes.TEXT, allowNull: true },
    createdBy: { type: DataTypes.INTEGER, allowNull: false },
    companyId: { type: DataTypes.INTEGER, allowNull: true },
  }, { sequelize, modelName: 'VendorDelivery' });
  return VendorDelivery;
};
