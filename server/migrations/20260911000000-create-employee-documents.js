'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('EmployeeDocuments', {
      id:                   { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      userId:               { type: Sequelize.INTEGER, allowNull: false, references: { model: 'Users', key: 'id' }, onDelete: 'CASCADE', onUpdate: 'CASCADE' },
      uploadedBy:           { type: Sequelize.INTEGER, allowNull: false, references: { model: 'Users', key: 'id' }, onDelete: 'CASCADE', onUpdate: 'CASCADE' },
      type:                 { type: Sequelize.ENUM('KTP', 'NPWP', 'CONTRACT', 'OTHER'), allowNull: false },
      title:                { type: Sequelize.STRING(255), allowNull: false },
      url:                  { type: Sequelize.TEXT, allowNull: false },
      expiryDate:           { type: Sequelize.DATEONLY, allowNull: true },
      note:                 { type: Sequelize.TEXT, allowNull: true },
      expiryReminderSentAt: { type: Sequelize.DATE, allowNull: true },
      companyId:            { type: Sequelize.INTEGER, allowNull: true },
      createdAt:            { type: Sequelize.DATE, allowNull: false },
      updatedAt:            { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('EmployeeDocuments', ['userId'], { name: 'employee_documents_user_idx' });
    await queryInterface.addIndex('EmployeeDocuments', ['expiryDate'], { name: 'employee_documents_expiry_idx' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('EmployeeDocuments');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_EmployeeDocuments_type";');
  },
};
