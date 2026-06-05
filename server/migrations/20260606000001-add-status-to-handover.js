'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Handovers', 'status', {
      type: Sequelize.ENUM('OPEN', 'CLOSED'),
      allowNull: false,
      defaultValue: 'OPEN',
    });
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('Handovers', 'status');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_Handovers_status";');
  },
};
