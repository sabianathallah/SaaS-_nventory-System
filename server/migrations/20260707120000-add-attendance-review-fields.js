'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Attendances', 'checkOutWorkMode', {
      type: Sequelize.ENUM('ON_SITE', 'FIELD'),
      allowNull: true,
    });
    await queryInterface.addColumn('Attendances', 'reviewStatus', {
      type: Sequelize.ENUM('NONE', 'PENDING_REVIEW', 'APPROVED', 'REJECTED'),
      allowNull: false,
      defaultValue: 'NONE',
    });
    await queryInterface.addColumn('Attendances', 'reviewedBy', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: 'Users', key: 'id' },
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE',
    });
    await queryInterface.addColumn('Attendances', 'reviewedAt', {
      type: Sequelize.DATE,
      allowNull: true,
    });
    await queryInterface.addColumn('Attendances', 'reviewNote', {
      type: Sequelize.TEXT,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('Attendances', 'reviewNote');
    await queryInterface.removeColumn('Attendances', 'reviewedAt');
    await queryInterface.removeColumn('Attendances', 'reviewedBy');
    await queryInterface.removeColumn('Attendances', 'reviewStatus');
    await queryInterface.removeColumn('Attendances', 'checkOutWorkMode');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_Attendances_reviewStatus";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_Attendances_checkOutWorkMode";');
  },
};
