'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Payslips', {
      id:                { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      userId:            { type: Sequelize.INTEGER, allowNull: false, references: { model: 'Users', key: 'id' }, onDelete: 'CASCADE', onUpdate: 'CASCADE' },
      periodStart:       { type: Sequelize.DATEONLY, allowNull: false },
      periodEnd:         { type: Sequelize.DATEONLY, allowNull: false },
      paymentDate:       { type: Sequelize.DATEONLY, allowNull: false },
      fixedSalary:        { type: Sequelize.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
      allowanceTransport: { type: Sequelize.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
      allowanceMeal:      { type: Sequelize.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
      overtime:           { type: Sequelize.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
      bonus:              { type: Sequelize.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
      otherDeductions:    { type: Sequelize.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
      totalEarnings:      { type: Sequelize.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
      totalDeductions:    { type: Sequelize.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
      netPay:             { type: Sequelize.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
      status:      { type: Sequelize.ENUM('DRAFT', 'PUBLISHED'), allowNull: false, defaultValue: 'DRAFT' },
      pdfUrl:      { type: Sequelize.STRING, allowNull: true },
      publishedBy: { type: Sequelize.INTEGER, allowNull: true, references: { model: 'Users', key: 'id' }, onDelete: 'SET NULL', onUpdate: 'CASCADE' },
      publishedAt: { type: Sequelize.DATE, allowNull: true },
      createdBy:   { type: Sequelize.INTEGER, allowNull: true, references: { model: 'Users', key: 'id' }, onDelete: 'SET NULL', onUpdate: 'CASCADE' },
      companyId:   { type: Sequelize.INTEGER, allowNull: true },
      createdAt:   { type: Sequelize.DATE, allowNull: false },
      updatedAt:   { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('Payslips', ['userId', 'periodStart', 'periodEnd'], {
      unique: true,
      name: 'payslips_user_period_unique',
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('Payslips');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_Payslips_status";');
  },
};
