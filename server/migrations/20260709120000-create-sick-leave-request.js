'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('SickLeaveRequests', {
      id:            { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      userId:        { type: Sequelize.INTEGER, allowNull: false, references: { model: 'Users', key: 'id' }, onDelete: 'CASCADE', onUpdate: 'CASCADE' },
      date:          { type: Sequelize.DATEONLY, allowNull: false },
      reason:        { type: Sequelize.TEXT, allowNull: false },
      attachmentUrl: { type: Sequelize.STRING, allowNull: true },
      status:        { type: Sequelize.ENUM('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'), allowNull: false, defaultValue: 'PENDING' },
      reviewedBy:    { type: Sequelize.INTEGER, allowNull: true, references: { model: 'Users', key: 'id' }, onDelete: 'SET NULL', onUpdate: 'CASCADE' },
      reviewedAt:    { type: Sequelize.DATE, allowNull: true },
      reviewNote:    { type: Sequelize.TEXT, allowNull: true },
      companyId:     { type: Sequelize.INTEGER, allowNull: true },
      createdAt:     { type: Sequelize.DATE, allowNull: false },
      updatedAt:     { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('SickLeaveRequests', ['userId', 'date'], { name: 'sick_leave_requests_user_date_idx' });
    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX "sick_leave_requests_active_unique"
      ON "SickLeaveRequests" ("userId", "date")
      WHERE status IN ('PENDING', 'APPROVED')
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query('DROP INDEX IF EXISTS "sick_leave_requests_active_unique"');
    await queryInterface.dropTable('SickLeaveRequests');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_SickLeaveRequests_status";');
  },
};
