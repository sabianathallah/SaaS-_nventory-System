'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('WfaSettings', {
      id:                   { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      companyId:            { type: Sequelize.INTEGER, allowNull: true, unique: true },
      defaultMonthlyQuota:  { type: Sequelize.INTEGER, allowNull: false, defaultValue: 4 },
      createdAt:            { type: Sequelize.DATE, allowNull: false },
      updatedAt:            { type: Sequelize.DATE, allowNull: false },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('WfaSettings');
  },
};
