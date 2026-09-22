'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class SkuChannelStock extends Model {
    static associate(models) {
      SkuChannelStock.belongsTo(models.ProductSKU, {
        foreignKey: { name: 'ProductSKUId', allowNull: false },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      });
      SkuChannelStock.belongsTo(models.Channel, {
        foreignKey: { name: 'ChannelId', allowNull: false },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      });
    }
  }
  SkuChannelStock.init({
    ProductSKUId: { type: DataTypes.INTEGER, allowNull: false },
    ChannelId:    { type: DataTypes.INTEGER, allowNull: false },
    isListed:     { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    companyId:    { type: DataTypes.INTEGER, allowNull: true },
  }, {
    sequelize,
    modelName: 'SkuChannelStock',
    indexes: [{ unique: true, fields: ['ProductSKUId', 'ChannelId'] }],
  });
  return SkuChannelStock;
};
