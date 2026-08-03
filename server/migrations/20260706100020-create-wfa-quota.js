'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('WfaQuotas', {
      id:         { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      userId:     { type: Sequelize.INTEGER, allowNull: false, references: { model: 'Users', key: 'id' }, onDelete: 'CASCADE', onUpdate: 'CASCADE' },
      month:      { type: Sequelize.INTEGER, allowNull: false },
      year:       { type: Sequelize.INTEGER, allowNull: false },
      allocated:  { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      used:       { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      companyId:  { type: Sequelize.INTEGER, allowNull: true },
      createdAt:  { type: Sequelize.DATE, allowNull: false },
      updatedAt:  { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('WfaQuotas', ['userId', 'month', 'year'], { unique: true, name: 'wfa_quotas_user_month_year_unique' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('WfaQuotas');
  },
};
