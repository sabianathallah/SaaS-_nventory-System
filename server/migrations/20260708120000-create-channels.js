'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Channels', {
      id:        { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      name:      { type: Sequelize.STRING, allowNull: false },
      isActive:  { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      companyId: { type: Sequelize.INTEGER, allowNull: true },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('Channels');
  },
};
