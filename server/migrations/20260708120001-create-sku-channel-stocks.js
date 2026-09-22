'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('SkuChannelStocks', {
      id:           { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      ProductSKUId: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'ProductSKUs', key: 'id' }, onDelete: 'CASCADE', onUpdate: 'CASCADE' },
      ChannelId:    { type: Sequelize.INTEGER, allowNull: false, references: { model: 'Channels',     key: 'id' }, onDelete: 'CASCADE', onUpdate: 'CASCADE' },
      isListed:     { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      companyId:    { type: Sequelize.INTEGER, allowNull: true },
      createdAt:    { type: Sequelize.DATE, allowNull: false },
      updatedAt:    { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('SkuChannelStocks', ['ProductSKUId', 'ChannelId'], { unique: true, name: 'sku_channel_stocks_unique' });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('SkuChannelStocks');
  },
};
