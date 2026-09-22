'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Shifts', {
      id:         { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      name:       { type: Sequelize.STRING, allowNull: false },
      startTime:  { type: Sequelize.TIME, allowNull: false },
      endTime:    { type: Sequelize.TIME, allowNull: false },
      companyId:  { type: Sequelize.INTEGER, allowNull: true },
      createdAt:  { type: Sequelize.DATE, allowNull: false },
      updatedAt:  { type: Sequelize.DATE, allowNull: false },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('Shifts');
  },
};
