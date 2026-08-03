'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('VendorDeliveries', 'selisihStatus', {
      type: Sequelize.STRING(20),
      allowNull: true,
      defaultValue: null,
    });
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('VendorDeliveries', 'selisihStatus');
  },
};
