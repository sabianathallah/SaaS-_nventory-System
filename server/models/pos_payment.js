'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class PosPayment extends Model {
    static associate(models) {
      PosPayment.belongsTo(models.PosOrder, { foreignKey: 'orderId', as: 'order' });
    }
  }
  PosPayment.init({
    orderId:   { type: DataTypes.INTEGER, allowNull: false },
    // CASH | QRIS | TRANSFER | EDC | OTHER; amount = bagian total yang dibayar dengan metode ini (cash sudah dikurangi kembalian)
    method:    { type: DataTypes.STRING(20), allowNull: false },
    amount:    { type: DataTypes.INTEGER, allowNull: false },
    reference: { type: DataTypes.STRING(100), allowNull: true },
  }, { sequelize, modelName: 'PosPayment' });
  return PosPayment;
};
