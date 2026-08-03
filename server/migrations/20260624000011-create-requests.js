'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Requests', {
      id:               { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      requestTypeId:    { type: Sequelize.INTEGER, allowNull: false, references: { model: 'RequestTypes', key: 'id' }, onDelete: 'RESTRICT' },
      requestorId:      { type: Sequelize.INTEGER, allowNull: false, references: { model: 'Users', key: 'id' }, onDelete: 'RESTRICT' },
      divisi:           { type: Sequelize.STRING(100), allowNull: true },
      recipientName:    { type: Sequelize.STRING(200), allowNull: true },
      recipientAddress: { type: Sequelize.TEXT, allowNull: true },
      neededAt:         { type: Sequelize.DATEONLY, allowNull: true },
      note:             { type: Sequelize.TEXT, allowNull: true },
      status:           { type: Sequelize.ENUM('PENDING','APPROVED','REJECTED','SENT','DONE'), allowNull: false, defaultValue: 'PENDING' },
      needsReturn:      { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      sentAt:           { type: Sequelize.DATEONLY, allowNull: true },
      trackingNumber:   { type: Sequelize.STRING(200), allowNull: true },
      returnedAt:       { type: Sequelize.DATEONLY, allowNull: true },
      processedBy:      { type: Sequelize.INTEGER, allowNull: true, references: { model: 'Users', key: 'id' }, onDelete: 'SET NULL' },
      rejectionReason:  { type: Sequelize.TEXT, allowNull: true },
      companyId:        { type: Sequelize.INTEGER, allowNull: true, references: { model: 'Companies', key: 'id' }, onDelete: 'CASCADE' },
      createdAt:        { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
      updatedAt:        { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
    });
    await queryInterface.addIndex('Requests', ['companyId']);
    await queryInterface.addIndex('Requests', ['requestorId']);
    await queryInterface.addIndex('Requests', ['status']);
    await queryInterface.addIndex('Requests', ['requestTypeId']);
  },
  async down(queryInterface) {
    await queryInterface.dropTable('Requests');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_Requests_status"');
  },
};
