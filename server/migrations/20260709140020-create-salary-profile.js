'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('SalaryProfiles', {
      id:                 { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      userId:             { type: Sequelize.INTEGER, allowNull: false, unique: true, references: { model: 'Users', key: 'id' }, onDelete: 'CASCADE', onUpdate: 'CASCADE' },
      fixedSalary:        { type: Sequelize.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
      allowanceTransport: { type: Sequelize.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
      allowanceMeal:      { type: Sequelize.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
      companyId:          { type: Sequelize.INTEGER, allowNull: true },
      createdAt:          { type: Sequelize.DATE, allowNull: false },
      updatedAt:          { type: Sequelize.DATE, allowNull: false },
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('SalaryProfiles');
  },
};
