'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('OfficeLocations', {
      id:            { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      name:          { type: Sequelize.STRING, allowNull: false },
      address:       { type: Sequelize.TEXT, allowNull: true },
      latitude:      { type: Sequelize.DECIMAL(10, 7), allowNull: false },
      longitude:     { type: Sequelize.DECIMAL(10, 7), allowNull: false },
      radiusMeters:  { type: Sequelize.INTEGER, allowNull: false, defaultValue: 150 },
      companyId:     { type: Sequelize.INTEGER, allowNull: true },
      createdAt:     { type: Sequelize.DATE, allowNull: false },
      updatedAt:     { type: Sequelize.DATE, allowNull: false },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('OfficeLocations');
  },
};
