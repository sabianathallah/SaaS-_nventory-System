'use strict';
const { ALL_PERMISSIONS } = require('../helpers/permissions');

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Permissions', {
      id:        { allowNull: false, autoIncrement: true, primaryKey: true, type: Sequelize.INTEGER },
      key:       { type: Sequelize.STRING(100), allowNull: false, unique: true },
      label:     { type: Sequelize.STRING(200), allowNull: false },
      group:     { type: Sequelize.STRING(100), allowNull: false },
      createdAt: { allowNull: false, type: Sequelize.DATE },
      updatedAt: { allowNull: false, type: Sequelize.DATE },
    });

    const now = new Date();
    await queryInterface.bulkInsert('Permissions',
      ALL_PERMISSIONS.map(p => ({ key: p.key, label: p.label, group: p.group, createdAt: now, updatedAt: now }))
    );
  },
  async down(queryInterface) {
    await queryInterface.dropTable('Permissions');
  },
};
