'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('ManualShipments', 'recipientName', {
      type: Sequelize.STRING(150),
      allowNull: true,
    });
    await queryInterface.addColumn('ManualShipments', 'recipientAddress', {
      type: Sequelize.TEXT,
      allowNull: true,
    });
    await queryInterface.addColumn('ManualShipments', 'recipientPhone', {
      type: Sequelize.STRING(30),
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('ManualShipments', 'recipientName');
    await queryInterface.removeColumn('ManualShipments', 'recipientAddress');
    await queryInterface.removeColumn('ManualShipments', 'recipientPhone');
  },
};
