'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Tasks', 'isImportant', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
    await queryInterface.addColumn('Tasks', 'myDayDate', {
      type: Sequelize.DATEONLY,
      allowNull: true,
      defaultValue: null,
    });
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('Tasks', 'isImportant');
    await queryInterface.removeColumn('Tasks', 'myDayDate');
  },
};
