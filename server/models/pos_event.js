'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class PosEvent extends Model {
    static associate(models) {
      PosEvent.belongsTo(models.Warehouse, { foreignKey: 'WarehouseId' });
      PosEvent.belongsTo(models.Channel,   { foreignKey: 'ChannelId' });
      PosEvent.belongsTo(models.User,      { foreignKey: 'createdBy', as: 'Creator' });
      PosEvent.hasMany(models.PosShift, { foreignKey: 'eventId', as: 'shifts' });
      PosEvent.hasMany(models.PosOrder, { foreignKey: 'eventId', as: 'orders' });
    }
  }
  PosEvent.init({
    companyId:     { type: DataTypes.INTEGER, allowNull: true },
    name:          { type: DataTypes.STRING(150), allowNull: false },
    location:      { type: DataTypes.STRING(200), allowNull: true },
    startDate:     { type: DataTypes.DATEONLY, allowNull: true },
    endDate:       { type: DataTypes.DATEONLY, allowNull: true },
    WarehouseId:   { type: DataTypes.INTEGER, allowNull: false },
    ChannelId:     { type: DataTypes.INTEGER, allowNull: false },
    // PREP = persiapan (transfer stok), OPEN = kasir boleh jualan, CLOSED = selesai
    status:        { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'PREP' },
    receiptHeader: { type: DataTypes.TEXT, allowNull: true },
    receiptFooter: { type: DataTypes.TEXT, allowNull: true },
    // batas beli per orang: { qty, productIds: [] (kosong = semua produk), perPhone }
    purchaseLimit: { type: DataTypes.JSONB, allowNull: true },
    createdBy:     { type: DataTypes.INTEGER, allowNull: true },
  }, { sequelize, modelName: 'PosEvent' });
  return PosEvent;
};
