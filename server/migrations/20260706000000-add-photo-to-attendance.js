'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Attendances', 'checkInPhoto', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('Attendances', 'checkOutPhoto', {
      type: Sequelize.STRING,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('Attendances', 'checkInPhoto');
    await queryInterface.removeColumn('Attendances', 'checkOutPhoto');
  },
};
