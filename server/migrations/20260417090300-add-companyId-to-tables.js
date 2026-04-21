'use strict';

const TABLES = [
  'Categories',
  'Warehouses',
  'Suppliers',
  'Products',
  'Stocks',
  'Stock_In_Headers',
  'Stock_Out_Headers',
  'Stock_Opname_Sessions',
  'Stock_Movements',
];

module.exports = {
  async up(queryInterface, Sequelize) {
    for (const table of TABLES) {
      await queryInterface.addColumn(table, 'companyId', {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'Companies', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      });
    }
  },
  async down(queryInterface, Sequelize) {
    for (const table of TABLES) {
      await queryInterface.removeColumn(table, 'companyId');
    }
  }
};
