'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Vendors', {
      id:          { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      name:        { type: Sequelize.STRING(255), allowNull: false },
      vendorCode:  { type: Sequelize.STRING(50),  allowNull: false, unique: true },
      contact:     { type: Sequelize.STRING(255), allowNull: true },
      phone:       { type: Sequelize.STRING(50),  allowNull: true },
      email:       { type: Sequelize.STRING(255), allowNull: true },
      address:     { type: Sequelize.TEXT,        allowNull: true },
      companyId:   { type: Sequelize.INTEGER,     allowNull: true },
      createdAt:   { type: Sequelize.DATE,        allowNull: false },
      updatedAt:   { type: Sequelize.DATE,        allowNull: false },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('Vendors');
  },
};
