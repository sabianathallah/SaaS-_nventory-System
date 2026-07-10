'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('ManualShipments', 'skippedStockOut', {
      type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('ManualShipments', 'skippedStockOut');
  },
};
