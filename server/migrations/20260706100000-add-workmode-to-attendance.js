'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Attendances', 'workMode', {
      type: Sequelize.ENUM('ON_SITE', 'WFA', 'FIELD'),
      allowNull: false,
      defaultValue: 'ON_SITE',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('Attendances', 'workMode');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_Attendances_workMode";');
  },
};
