'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    const q = (sql) => queryInterface.sequelize.query(sql);

    // 1. recipientPhone di Requests
    await queryInterface.addColumn('Requests', 'recipientPhone', {
      type: Sequelize.STRING(30), allowNull: true, defaultValue: null,
    });

    // 2. manualShipmentId di Requests
    await queryInterface.addColumn('Requests', 'manualShipmentId', {
      type: Sequelize.INTEGER, allowNull: true, defaultValue: null,
      references: { model: 'ManualShipments', key: 'id' },
      onUpdate: 'CASCADE', onDelete: 'SET NULL',
    });

    // 3. requiresShipping di RequestTypes
    await queryInterface.addColumn('RequestTypes', 'requiresShipping', {
      type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false,
    });

    // 4. sourceRequestId di ManualShipments
    await queryInterface.addColumn('ManualShipments', 'sourceRequestId', {
      type: Sequelize.INTEGER, allowNull: true, defaultValue: null,
      references: { model: 'Requests', key: 'id' },
      onUpdate: 'CASCADE', onDelete: 'SET NULL',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('ManualShipments', 'sourceRequestId');
    await queryInterface.removeColumn('RequestTypes', 'requiresShipping');
    await queryInterface.removeColumn('Requests', 'manualShipmentId');
    await queryInterface.removeColumn('Requests', 'recipientPhone');
  },
};
