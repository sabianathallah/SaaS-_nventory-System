'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('LeaveRequests', {
      id:           { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      userId:       { type: Sequelize.INTEGER, allowNull: false, references: { model: 'Users', key: 'id' }, onDelete: 'CASCADE', onUpdate: 'CASCADE' },
      leaveTypeId:  { type: Sequelize.INTEGER, allowNull: false, references: { model: 'LeaveTypes', key: 'id' }, onDelete: 'CASCADE', onUpdate: 'CASCADE' },
      startDate:    { type: Sequelize.DATEONLY, allowNull: false },
      endDate:      { type: Sequelize.DATEONLY, allowNull: false },
      days:         { type: Sequelize.INTEGER, allowNull: false },
      reason:       { type: Sequelize.TEXT, allowNull: true },
      status:       { type: Sequelize.ENUM('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'), allowNull: false, defaultValue: 'PENDING' },
      reviewedBy:   { type: Sequelize.INTEGER, allowNull: true, references: { model: 'Users', key: 'id' }, onDelete: 'SET NULL', onUpdate: 'CASCADE' },
      reviewedAt:   { type: Sequelize.DATE, allowNull: true },
      reviewNote:   { type: Sequelize.TEXT, allowNull: true },
      companyId:    { type: Sequelize.INTEGER, allowNull: true },
      createdAt:    { type: Sequelize.DATE, allowNull: false },
      updatedAt:    { type: Sequelize.DATE, allowNull: false },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('LeaveRequests');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_LeaveRequests_status";');
  },
};
