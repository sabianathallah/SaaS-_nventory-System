'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Attendances', 'lateExcuseStatus', {
      type: Sequelize.ENUM('NONE', 'PENDING_REVIEW', 'APPROVED', 'REJECTED'),
      allowNull: false,
      defaultValue: 'NONE',
    });
    await queryInterface.addColumn('Attendances', 'lateExcuseReason', {
      type: Sequelize.TEXT,
      allowNull: true,
    });
    await queryInterface.addColumn('Attendances', 'lateExcuseReviewedBy', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: 'Users', key: 'id' },
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE',
    });
    await queryInterface.addColumn('Attendances', 'lateExcuseReviewedAt', {
      type: Sequelize.DATE,
      allowNull: true,
    });
    await queryInterface.addColumn('Attendances', 'lateExcuseReviewNote', {
      type: Sequelize.TEXT,
      allowNull: true,
    });
    await queryInterface.addColumn('Attendances', 'lateExcuseRequestId', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: 'LateExcuseRequests', key: 'id' },
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('Attendances', 'lateExcuseRequestId');
    await queryInterface.removeColumn('Attendances', 'lateExcuseReviewNote');
    await queryInterface.removeColumn('Attendances', 'lateExcuseReviewedAt');
    await queryInterface.removeColumn('Attendances', 'lateExcuseReviewedBy');
    await queryInterface.removeColumn('Attendances', 'lateExcuseReason');
    await queryInterface.removeColumn('Attendances', 'lateExcuseStatus');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_Attendances_lateExcuseStatus";');
  },
};
