'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('VendorDeliveryItems', 'qtyReady', {
      type: Sequelize.INTEGER,
      allowNull: true,
      defaultValue: null,
    });
    await queryInterface.addColumn('VendorDeliveryItems', 'qtyReject', {
      type: Sequelize.INTEGER,
      allowNull: true,
      defaultValue: null,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('VendorDeliveryItems', 'qtyReady');
    await queryInterface.removeColumn('VendorDeliveryItems', 'qtyReject');
  },
};
