'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('RequestItems', {
      id:           { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      requestId:    { type: Sequelize.INTEGER, allowNull: false, references: { model: 'Requests', key: 'id' }, onDelete: 'CASCADE' },
      ProductSKUId: { type: Sequelize.INTEGER, allowNull: true, references: { model: 'ProductSKUs', key: 'id' }, onDelete: 'SET NULL' },
      productName:  { type: Sequelize.STRING(300), allowNull: false },
      variantLabel: { type: Sequelize.STRING(200), allowNull: true },
      qty:          { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 },
      note:         { type: Sequelize.TEXT, allowNull: true },
      companyId:    { type: Sequelize.INTEGER, allowNull: true },
      createdAt:    { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
      updatedAt:    { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
    });
    await queryInterface.addIndex('RequestItems', ['requestId']);
  },
  async down(queryInterface) {
    await queryInterface.dropTable('RequestItems');
  },
};
