'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Stock_Out_Draft_Items', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      DraftId: {
        type: Sequelize.INTEGER, allowNull: false,
        references: { model: 'Stock_Out_Drafts', key: 'id' },
        onDelete: 'CASCADE', onUpdate: 'CASCADE',
      },
      ProductSKUId: {
        type: Sequelize.INTEGER, allowNull: true,
        references: { model: 'ProductSKUs', key: 'id' },
        onDelete: 'SET NULL', onUpdate: 'CASCADE',
      },
      ProductId: {
        type: Sequelize.INTEGER, allowNull: true,
        references: { model: 'Products', key: 'id' },
        onDelete: 'SET NULL', onUpdate: 'CASCADE',
      },
      quantity:  { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 },
      companyId: { type: Sequelize.INTEGER, allowNull: true },
      createdAt: { type: Sequelize.DATE,    allowNull: false },
      updatedAt: { type: Sequelize.DATE,    allowNull: false },
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('Stock_Out_Draft_Items');
  },
};
