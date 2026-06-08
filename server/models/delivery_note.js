'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class DeliveryNote extends Model {
    static associate(models) {
      DeliveryNote.belongsTo(models.Vendor, { foreignKey: 'vendorId', as: 'Vendor' });
      DeliveryNote.belongsTo(models.User,   { foreignKey: 'createdBy', as: 'Creator' });
      DeliveryNote.hasOne(models.VendorDelivery, { foreignKey: 'deliveryNoteId', as: 'delivery' });
    }
  }
  DeliveryNote.init({
    vendorId:  { type: DataTypes.INTEGER, allowNull: true },
    date:      { type: DataTypes.DATEONLY, allowNull: false },
    photoUrl:  { type: DataTypes.TEXT, allowNull: true },
    notes:     { type: DataTypes.TEXT, allowNull: true },
    createdBy: { type: DataTypes.INTEGER, allowNull: false },
    companyId: { type: DataTypes.INTEGER, allowNull: true },
  }, { sequelize, modelName: 'DeliveryNote' });
  return DeliveryNote;
};
