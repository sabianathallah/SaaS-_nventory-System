'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('WfaRequests', {
      id:            { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      userId:        { type: Sequelize.INTEGER, allowNull: false, references: { model: 'Users', key: 'id' }, onDelete: 'CASCADE', onUpdate: 'CASCADE' },
      date:          { type: Sequelize.DATEONLY, allowNull: false },
      reason:        { type: Sequelize.TEXT, allowNull: true },
      isOverQuota:   { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      status:        { type: Sequelize.ENUM('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'), allowNull: false, defaultValue: 'PENDING' },
      reviewedBy:    { type: Sequelize.INTEGER, allowNull: true, references: { model: 'Users', key: 'id' }, onDelete: 'SET NULL', onUpdate: 'CASCADE' },
      reviewedAt:    { type: Sequelize.DATE, allowNull: true },
      reviewNote:    { type: Sequelize.TEXT, allowNull: true },
      companyId:     { type: Sequelize.INTEGER, allowNull: true },
      createdAt:     { type: Sequelize.DATE, allowNull: false },
      updatedAt:     { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('WfaRequests', ['userId', 'date'], { name: 'wfa_requests_user_date_idx' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('WfaRequests');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_WfaRequests_status";');
  },
};
