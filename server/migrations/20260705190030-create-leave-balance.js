'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('LeaveBalances', {
      id:          { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      userId:      { type: Sequelize.INTEGER, allowNull: false, references: { model: 'Users', key: 'id' }, onDelete: 'CASCADE', onUpdate: 'CASCADE' },
      leaveTypeId: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'LeaveTypes', key: 'id' }, onDelete: 'CASCADE', onUpdate: 'CASCADE' },
      year:        { type: Sequelize.INTEGER, allowNull: false },
      allocated:   { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      used:        { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      companyId:   { type: Sequelize.INTEGER, allowNull: true },
      createdAt:   { type: Sequelize.DATE, allowNull: false },
      updatedAt:   { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('LeaveBalances', ['userId', 'leaveTypeId', 'year'], { unique: true, name: 'leave_balances_user_type_year_unique' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('LeaveBalances');
  },
};
