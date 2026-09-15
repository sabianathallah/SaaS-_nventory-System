'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('VendorDeliveries', 'status', {
      type: Sequelize.STRING(20),
      allowNull: false,
      defaultValue: 'open',
    });
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('VendorDeliveries', 'status');
  },
};
