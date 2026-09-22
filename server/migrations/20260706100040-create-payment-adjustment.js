'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('PaymentAdjustments', {
      id:            { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      userId:        { type: Sequelize.INTEGER, allowNull: false, references: { model: 'Users', key: 'id' }, onDelete: 'CASCADE', onUpdate: 'CASCADE' },
      wfaRequestId:  { type: Sequelize.INTEGER, allowNull: true, references: { model: 'WfaRequests', key: 'id' }, onDelete: 'SET NULL', onUpdate: 'CASCADE' },
      type:          { type: Sequelize.STRING(50), allowNull: false, defaultValue: 'WFA_OVERQUOTA' },
      month:         { type: Sequelize.INTEGER, allowNull: false },
      year:          { type: Sequelize.INTEGER, allowNull: false },
      amount:        { type: Sequelize.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
      note:          { type: Sequelize.TEXT, allowNull: true },
      createdBy:     { type: Sequelize.INTEGER, allowNull: false, references: { model: 'Users', key: 'id' }, onDelete: 'CASCADE', onUpdate: 'CASCADE' },
      companyId:     { type: Sequelize.INTEGER, allowNull: true },
      createdAt:     { type: Sequelize.DATE, allowNull: false },
      updatedAt:     { type: Sequelize.DATE, allowNull: false },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('PaymentAdjustments');
  },
};
