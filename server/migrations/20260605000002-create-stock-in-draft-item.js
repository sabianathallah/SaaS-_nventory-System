'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Stock_In_Draft_Items', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      DraftId: {
        type: Sequelize.INTEGER, allowNull: false,
        references: { model: 'Stock_In_Drafts', key: 'id' },
        onDelete: 'CASCADE', onUpdate: 'CASCADE',
      },
      ProductSKUId: {
        type: Sequelize.INTEGER, allowNull: true,
        references: { model: 'ProductSKUs', key: 'id' },
        onDelete: 'SET NULL', onUpdate: 'CASCADE',
      },
      quantity:  { type: Sequelize.INTEGER,        allowNull: false, defaultValue: 1 },
      price:     { type: Sequelize.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
      companyId: { type: Sequelize.INTEGER,        allowNull: true },
      createdAt: { type: Sequelize.DATE,           allowNull: false },
      updatedAt: { type: Sequelize.DATE,           allowNull: false },
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('Stock_In_Draft_Items');
  },
};
