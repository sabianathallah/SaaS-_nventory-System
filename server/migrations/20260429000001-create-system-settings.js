'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('SystemSettings', {
      id:        { allowNull: false, autoIncrement: true, primaryKey: true, type: Sequelize.INTEGER },
      key:       { type: Sequelize.STRING, allowNull: false, unique: true },
      value:     { type: Sequelize.JSON,   allowNull: false },
      createdAt: { allowNull: false, type: Sequelize.DATE },
      updatedAt: { allowNull: false, type: Sequelize.DATE },
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('SystemSettings');
  },
};
