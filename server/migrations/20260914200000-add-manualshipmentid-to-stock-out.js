'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Stock_Out_Drafts', 'manualShipmentId', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: 'ManualShipments', key: 'id' },
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE',
    });
    await queryInterface.addColumn('Stock_Out_Headers', 'manualShipmentId', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: 'ManualShipments', key: 'id' },
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE',
    });
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('Stock_Out_Drafts', 'manualShipmentId');
    await queryInterface.removeColumn('Stock_Out_Headers', 'manualShipmentId');
  },
};
