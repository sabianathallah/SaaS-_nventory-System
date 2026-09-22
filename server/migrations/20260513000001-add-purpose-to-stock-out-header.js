'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Stock_Out_Headers', 'purpose', {
      type: Sequelize.STRING(100),
      allowNull: false,
      defaultValue: 'Lainnya',
    });
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('Stock_Out_Headers', 'purpose');
  },
};
