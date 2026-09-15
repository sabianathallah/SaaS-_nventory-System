'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Stock_Movements', 'repairQtyReturned', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
    });
    await queryInterface.addColumn('Stock_Movements', 'repairReturnedAt', {
      type: Sequelize.DATE,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('Stock_Movements', 'repairReturnedAt');
    await queryInterface.removeColumn('Stock_Movements', 'repairQtyReturned');
  },
};
