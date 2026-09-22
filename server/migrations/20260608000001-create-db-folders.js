'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('DbFolders', {
      id:          { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      name:        { type: Sequelize.STRING(100), allowNull: false },
      color:       { type: Sequelize.STRING(20), allowNull: false, defaultValue: '#6366f1' },
      description: { type: Sequelize.STRING, allowNull: true },
      position:    { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      createdBy:   { type: Sequelize.INTEGER, allowNull: false, references: { model: 'Users', key: 'id' }, onDelete: 'CASCADE', onUpdate: 'CASCADE' },
      createdAt:   { type: Sequelize.DATE, allowNull: false },
      updatedAt:   { type: Sequelize.DATE, allowNull: false },
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('DbFolders');
  },
};
