'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('LeaveTypes', {
      id:               { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      name:             { type: Sequelize.STRING, allowNull: false },
      maxDaysPerYear:   { type: Sequelize.INTEGER, allowNull: false, defaultValue: 12 },
      companyId:        { type: Sequelize.INTEGER, allowNull: true },
      createdAt:        { type: Sequelize.DATE, allowNull: false },
      updatedAt:        { type: Sequelize.DATE, allowNull: false },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('LeaveTypes');
  },
};
