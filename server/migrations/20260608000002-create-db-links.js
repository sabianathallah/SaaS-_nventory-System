'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('DbLinks', {
      id:          { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      title:       { type: Sequelize.STRING(200), allowNull: false },
      url:         { type: Sequelize.TEXT, allowNull: false },
      description: { type: Sequelize.STRING, allowNull: true },
      position:    { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      folderId:    { type: Sequelize.INTEGER, allowNull: false, references: { model: 'DbFolders', key: 'id' }, onDelete: 'CASCADE', onUpdate: 'CASCADE' },
      createdBy:   { type: Sequelize.INTEGER, allowNull: false, references: { model: 'Users', key: 'id' }, onDelete: 'CASCADE', onUpdate: 'CASCADE' },
      createdAt:   { type: Sequelize.DATE, allowNull: false },
      updatedAt:   { type: Sequelize.DATE, allowNull: false },
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('DbLinks');
  },
};
