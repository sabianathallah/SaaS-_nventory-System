'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('SubCategories', {
      id:        { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      name:      { type: Sequelize.STRING, allowNull: false },
      companyId: { type: Sequelize.INTEGER, allowNull: true },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('SubCategories');
  },
};
