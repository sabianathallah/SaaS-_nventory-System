'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Stock_Out_Drafts', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      WarehouseId: {
        type: Sequelize.INTEGER, allowNull: true,
        references: { model: 'Warehouses', key: 'id' },
        onDelete: 'SET NULL', onUpdate: 'CASCADE',
      },
      date:      { type: Sequelize.DATEONLY, allowNull: true },
      purpose:   { type: Sequelize.STRING,   allowNull: true },
      note:      { type: Sequelize.STRING,   allowNull: true },
      status:    { type: Sequelize.STRING,   allowNull: false, defaultValue: 'draft' },
      createdBy: {
        type: Sequelize.INTEGER, allowNull: false,
        references: { model: 'Users', key: 'id' },
        onDelete: 'CASCADE', onUpdate: 'CASCADE',
      },
      companyId: { type: Sequelize.INTEGER, allowNull: true },
      createdAt: { type: Sequelize.DATE,    allowNull: false },
      updatedAt: { type: Sequelize.DATE,    allowNull: false },
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('Stock_Out_Drafts');
  },
};
