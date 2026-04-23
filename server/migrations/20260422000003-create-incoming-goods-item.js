'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('IncomingGoodsItems', {
      id:               { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      IncomingGoodsId:  { type: Sequelize.INTEGER, allowNull: false, references: { model: 'IncomingGoods', key: 'id' }, onDelete: 'CASCADE', onUpdate: 'CASCADE' },
      ProductId:        { type: Sequelize.INTEGER, allowNull: false, references: { model: 'Products', key: 'id' }, onDelete: 'CASCADE', onUpdate: 'CASCADE' },
      qtyOrdered:       { type: Sequelize.INTEGER, allowNull: false },
      qtyReceived:      { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      qtyReady:         { type: Sequelize.INTEGER, allowNull: true },
      qtyReject:        { type: Sequelize.INTEGER, allowNull: true },
      unit:             { type: Sequelize.STRING(50), allowNull: false },
      notes:            { type: Sequelize.TEXT, allowNull: true },
      companyId:        { type: Sequelize.INTEGER, allowNull: true },
      createdAt:        { type: Sequelize.DATE, allowNull: false },
      updatedAt:        { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.addConstraint('IncomingGoodsItems', {
      fields: ['IncomingGoodsId', 'ProductId'],
      type: 'unique',
      name: 'unique_incoming_goods_product',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('IncomingGoodsItems');
  },
};
