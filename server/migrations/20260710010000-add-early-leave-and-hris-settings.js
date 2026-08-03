'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('HrisSettings', {
      id:               { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      companyId:        { type: Sequelize.INTEGER, allowNull: true, unique: true },
      minWorkMinutes:   { type: Sequelize.INTEGER, allowNull: false, defaultValue: 480 },
      lateGraceMinutes: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 15 },
      createdAt:        { type: Sequelize.DATE, allowNull: false },
      updatedAt:        { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.addColumn('Attendances', 'earlyLeaveStatus', {
      type: Sequelize.ENUM('NONE', 'PENDING_REVIEW', 'APPROVED', 'REJECTED'),
      allowNull: false,
      defaultValue: 'NONE',
    });
    await queryInterface.addColumn('Attendances', 'earlyLeaveReason', {
      type: Sequelize.TEXT,
      allowNull: true,
    });
    await queryInterface.addColumn('Attendances', 'earlyLeaveReviewedBy', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: 'Users', key: 'id' },
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE',
    });
    await queryInterface.addColumn('Attendances', 'earlyLeaveReviewedAt', {
      type: Sequelize.DATE,
      allowNull: true,
    });
    await queryInterface.addColumn('Attendances', 'earlyLeaveReviewNote', {
      type: Sequelize.TEXT,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('Attendances', 'earlyLeaveReviewNote');
    await queryInterface.removeColumn('Attendances', 'earlyLeaveReviewedAt');
    await queryInterface.removeColumn('Attendances', 'earlyLeaveReviewedBy');
    await queryInterface.removeColumn('Attendances', 'earlyLeaveReason');
    await queryInterface.removeColumn('Attendances', 'earlyLeaveStatus');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_Attendances_earlyLeaveStatus";');
    await queryInterface.dropTable('HrisSettings');
  },
};
