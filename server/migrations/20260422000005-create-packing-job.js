'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('PackingJobs', {
      id:              { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      IncomingGoodsId: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'IncomingGoods', key: 'id' }, onDelete: 'CASCADE', onUpdate: 'CASCADE' },
      assignedTo:      { type: Sequelize.INTEGER, allowNull: false, references: { model: 'Users', key: 'id' }, onDelete: 'CASCADE', onUpdate: 'CASCADE' },
      assignedBy:      { type: Sequelize.INTEGER, allowNull: false, references: { model: 'Users', key: 'id' }, onDelete: 'CASCADE', onUpdate: 'CASCADE' },
      assignedAt:      { type: Sequelize.DATE, allowNull: false },
      status:          { type: Sequelize.ENUM('PENDING','IN_PROGRESS','SUBMITTED','VERIFIED'), allowNull: false, defaultValue: 'PENDING' },
      startedAt:       { type: Sequelize.DATE, allowNull: true },
      submittedAt:     { type: Sequelize.DATE, allowNull: true },
      verifiedAt:      { type: Sequelize.DATE, allowNull: true },
      verifiedBy:      { type: Sequelize.INTEGER, allowNull: true, references: { model: 'Users', key: 'id' }, onDelete: 'SET NULL', onUpdate: 'CASCADE' },
      notes:           { type: Sequelize.TEXT, allowNull: true },
      companyId:       { type: Sequelize.INTEGER, allowNull: true },
      createdAt:       { type: Sequelize.DATE, allowNull: false },
      updatedAt:       { type: Sequelize.DATE, allowNull: false },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('PackingJobs');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_PackingJobs_status";');
  },
};
