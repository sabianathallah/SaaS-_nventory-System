'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Companies', 'legalName', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('Companies', 'address', {
      type: Sequelize.TEXT,
      allowNull: true,
    });
    await queryInterface.addColumn('Companies', 'contactPhone', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('Companies', 'contactEmail', {
      type: Sequelize.STRING,
      allowNull: true,
    });
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('Companies', 'contactEmail');
    await queryInterface.removeColumn('Companies', 'contactPhone');
    await queryInterface.removeColumn('Companies', 'address');
    await queryInterface.removeColumn('Companies', 'legalName');
  },
};
