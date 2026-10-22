'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class PosOrder extends Model {
    static associate(models) {
      PosOrder.belongsTo(models.PosEvent, { foreignKey: 'eventId', as: 'event' });
      PosOrder.belongsTo(models.PosShift, { foreignKey: 'shiftId', as: 'shift' });
      PosOrder.belongsTo(models.User,     { foreignKey: 'cashierId', as: 'Cashier' });
      PosOrder.belongsTo(models.Stock_Out_Header, { foreignKey: 'StockOutHeaderId', as: 'stockOut' });
      PosOrder.hasMany(models.PosOrderItem, { foreignKey: 'orderId', as: 'items' });
      PosOrder.hasMany(models.PosPayment,   { foreignKey: 'orderId', as: 'payments' });
    }
  }
  PosOrder.init({
    companyId:     { type: DataTypes.INTEGER, allowNull: true },
    eventId:       { type: DataTypes.INTEGER, allowNull: false },
    shiftId:       { type: DataTypes.INTEGER, allowNull: true },
    cashierId:     { type: DataTypes.INTEGER, allowNull: true },
    // dibuat di laptop kasir; kunci supaya transaksi offline yang dikirim ulang tidak dobel
    clientOrderId: { type: DataTypes.STRING(64), allowNull: false },
    orderNumber:   { type: DataTypes.STRING(40), allowNull: false },
    soldAt:        { type: DataTypes.DATE, allowNull: false },
    subtotal:      { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    itemDiscount:  { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    orderDiscount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    total:         { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    cashReceived:  { type: DataTypes.INTEGER, allowNull: true },
    change:        { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    discountNote:  { type: DataTypes.STRING(200), allowNull: true },
    note:          { type: DataTypes.STRING(200), allowNull: true },
    status:        { type: DataTypes.STRING(10), allowNull: false, defaultValue: 'PAID' },
    // stok sistem kurang saat transaksi masuk (mis. dijual offline): tetap diterima, dicek saat opname
    needsReview:   { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    reviewNote:    { type: DataTypes.TEXT, allowNull: true },
    StockOutHeaderId: { type: DataTypes.INTEGER, allowNull: true },
    voidedAt:      { type: DataTypes.DATE, allowNull: true },
    voidedBy:      { type: DataTypes.INTEGER, allowNull: true },
    voidReason:    { type: DataTypes.STRING(200), allowNull: true },
  }, {
    sequelize,
    modelName: 'PosOrder',
    indexes: [{ unique: true, fields: ['companyId', 'clientOrderId'], name: 'pos_orders_company_client_uq' }],
  });
  return PosOrder;
};
