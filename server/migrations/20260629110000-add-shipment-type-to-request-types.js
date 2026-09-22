'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('RequestTypes', 'shipmentType', {
      type: Sequelize.STRING(20),
      allowNull: true,
      defaultValue: null,
    });
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('RequestTypes', 'shipmentType');
  },
};
