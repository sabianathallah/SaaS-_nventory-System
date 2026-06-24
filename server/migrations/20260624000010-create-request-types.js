'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('RequestTypes', {
      id:        { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      name:      { type: Sequelize.STRING(100), allowNull: false },
      companyId: { type: Sequelize.INTEGER, allowNull: true, references: { model: 'Companies', key: 'id' }, onDelete: 'CASCADE' },
      isActive:  { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
    });
    await queryInterface.addIndex('RequestTypes', ['companyId']);
  },
  async down(queryInterface) {
    await queryInterface.dropTable('RequestTypes');
  },
};
