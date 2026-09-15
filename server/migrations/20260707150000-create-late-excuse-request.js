'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('LateExcuseRequests', {
      id:            { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      userId:        { type: Sequelize.INTEGER, allowNull: false, references: { model: 'Users', key: 'id' }, onDelete: 'CASCADE', onUpdate: 'CASCADE' },
      date:          { type: Sequelize.DATEONLY, allowNull: false },
      expectedTime:  { type: Sequelize.STRING, allowNull: true },
      reason:        { type: Sequelize.TEXT, allowNull: true },
      status:        { type: Sequelize.ENUM('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'), allowNull: false, defaultValue: 'PENDING' },
      reviewedBy:    { type: Sequelize.INTEGER, allowNull: true, references: { model: 'Users', key: 'id' }, onDelete: 'SET NULL', onUpdate: 'CASCADE' },
      reviewedAt:    { type: Sequelize.DATE, allowNull: true },
      reviewNote:    { type: Sequelize.TEXT, allowNull: true },
      companyId:     { type: Sequelize.INTEGER, allowNull: true },
      createdAt:     { type: Sequelize.DATE, allowNull: false },
      updatedAt:     { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('LateExcuseRequests', ['userId', 'date'], { name: 'late_excuse_requests_user_date_idx' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('LateExcuseRequests');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_LateExcuseRequests_status";');
  },
};
