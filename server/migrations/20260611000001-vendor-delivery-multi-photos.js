'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.removeColumn('VendorDeliveries', 'sjPhoto');
    await queryInterface.addColumn('VendorDeliveries', 'sjPhotos', {
      type: Sequelize.JSON,
      allowNull: true,
      defaultValue: null,
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('VendorDeliveries', 'sjPhotos');
    await queryInterface.addColumn('VendorDeliveries', 'sjPhoto', {
      type: Sequelize.TEXT,
      allowNull: true,
    });
  },
};
