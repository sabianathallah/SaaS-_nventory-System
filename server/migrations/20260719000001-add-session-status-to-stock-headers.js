'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Stock_In_Headers', 'status', {
      type: Sequelize.STRING(10),
      allowNull: false,
      defaultValue: 'closed',
    });
    await queryInterface.addColumn('Stock_Out_Headers', 'status', {
      type: Sequelize.STRING(10),
      allowNull: false,
      defaultValue: 'closed',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('Stock_In_Headers', 'status');
    await queryInterface.removeColumn('Stock_Out_Headers', 'status');
  },
};
