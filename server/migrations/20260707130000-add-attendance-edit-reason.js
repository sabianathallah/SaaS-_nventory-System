'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Attendances', 'editReason', {
      type: Sequelize.TEXT,
      allowNull: true,
    });
    await queryInterface.addColumn('Attendances', 'editedAt', {
      type: Sequelize.DATE,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('Attendances', 'editedAt');
    await queryInterface.removeColumn('Attendances', 'editReason');
  },
};
