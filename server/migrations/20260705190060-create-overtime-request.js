'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('OvertimeRequests', {
      id:            { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      userId:        { type: Sequelize.INTEGER, allowNull: false, references: { model: 'Users', key: 'id' }, onDelete: 'CASCADE', onUpdate: 'CASCADE' },
      attendanceId:  { type: Sequelize.INTEGER, allowNull: true, references: { model: 'Attendances', key: 'id' }, onDelete: 'SET NULL', onUpdate: 'CASCADE' },
      date:          { type: Sequelize.DATEONLY, allowNull: false },
      startTime:     { type: Sequelize.TIME, allowNull: false },
      endTime:       { type: Sequelize.TIME, allowNull: false },
      reason:        { type: Sequelize.TEXT, allowNull: true },
      status:        { type: Sequelize.ENUM('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'), allowNull: false, defaultValue: 'PENDING' },
      reviewedBy:    { type: Sequelize.INTEGER, allowNull: true, references: { model: 'Users', key: 'id' }, onDelete: 'SET NULL', onUpdate: 'CASCADE' },
      reviewedAt:    { type: Sequelize.DATE, allowNull: true },
      reviewNote:    { type: Sequelize.TEXT, allowNull: true },
      companyId:     { type: Sequelize.INTEGER, allowNull: true },
      createdAt:     { type: Sequelize.DATE, allowNull: false },
      updatedAt:     { type: Sequelize.DATE, allowNull: false },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('OvertimeRequests');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_OvertimeRequests_status";');
  },
};
