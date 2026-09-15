'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Handovers', {
      id:          { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      ekspedisi:   { type: Sequelize.STRING(100), allowNull: false },
      date:        { type: Sequelize.DATEONLY, allowNull: false },
      note:        { type: Sequelize.STRING, allowNull: true },
      createdBy:   { type: Sequelize.INTEGER, allowNull: false, references: { model: 'Users', key: 'id' }, onDelete: 'CASCADE', onUpdate: 'CASCADE' },
      companyId:   { type: Sequelize.INTEGER, allowNull: true },
      createdAt:   { type: Sequelize.DATE, allowNull: false },
      updatedAt:   { type: Sequelize.DATE, allowNull: false },
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('Handovers');
  },
};
