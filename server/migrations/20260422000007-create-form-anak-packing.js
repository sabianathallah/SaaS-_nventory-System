'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('FormAnakPackings', {
      id:              { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      formNumber:      { type: Sequelize.STRING(100), allowNull: false, unique: true },
      PackingJobId:    { type: Sequelize.INTEGER, allowNull: false, unique: true, references: { model: 'PackingJobs', key: 'id' }, onDelete: 'CASCADE', onUpdate: 'CASCADE' },
      workerId:        { type: Sequelize.INTEGER, allowNull: false, references: { model: 'Users', key: 'id' }, onDelete: 'CASCADE', onUpdate: 'CASCADE' },
      totalQtyPacked:  { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      totalQtyReady:   { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      totalQtyReject:  { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      snapshotResults: { type: Sequelize.JSONB, allowNull: false, defaultValue: [] },
      generatedBy:     { type: Sequelize.INTEGER, allowNull: false, references: { model: 'Users', key: 'id' }, onDelete: 'CASCADE', onUpdate: 'CASCADE' },
      generatedAt:     { type: Sequelize.DATE, allowNull: false },
      companyId:       { type: Sequelize.INTEGER, allowNull: true },
      createdAt:       { type: Sequelize.DATE, allowNull: false },
      updatedAt:       { type: Sequelize.DATE, allowNull: false },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('FormAnakPackings');
  },
};
