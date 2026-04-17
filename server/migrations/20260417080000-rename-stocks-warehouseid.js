'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('Stocks');

    if (table.WearhouseId && !table.WarehouseId) {
      await queryInterface.renameColumn('Stocks', 'WearhouseId', 'WarehouseId');
    }
  },
  async down(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('Stocks');

    if (table.WarehouseId && !table.WearhouseId) {
      await queryInterface.renameColumn('Stocks', 'WarehouseId', 'WearhouseId');
    }
  }
};
