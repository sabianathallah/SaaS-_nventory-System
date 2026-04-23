'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class IncomingGoodsItem extends Model {
    static associate(models) {
      IncomingGoodsItem.belongsTo(models.IncomingGoods, {
        foreignKey: { name: 'IncomingGoodsId', allowNull: false },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      });
      IncomingGoodsItem.belongsTo(models.Product, {
        foreignKey: { name: 'ProductId', allowNull: false },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      });
      IncomingGoodsItem.hasMany(models.PackingResult, {
        foreignKey: { name: 'IncomingGoodsItemId', allowNull: false },
        as: 'packingResults',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      });
    }
  }

  IncomingGoodsItem.init({
    IncomingGoodsId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: { notNull: { msg: 'IncomingGoods is required' } },
    },
    ProductId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: { notNull: { msg: 'Product is required' } },
    },
    qtyOrdered: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: { notNull: { msg: 'Qty ordered is required' }, min: { args: [1], msg: 'Qty ordered must be > 0' } },
    },
    qtyReceived: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: { min: { args: [0], msg: 'Qty received cannot be negative' } },
    },
    qtyReady:  { type: DataTypes.INTEGER, allowNull: true },
    qtyReject: { type: DataTypes.INTEGER, allowNull: true },
    unit: {
      type: DataTypes.STRING(50),
      allowNull: false,
      validate: { notNull: { msg: 'Unit is required' }, notEmpty: { msg: 'Unit is required' } },
    },
    notes:     { type: DataTypes.TEXT,    allowNull: true },
    companyId: { type: DataTypes.INTEGER, allowNull: true },
  }, {
    sequelize,
    modelName: 'IncomingGoodsItem',
  });

  return IncomingGoodsItem;
};
