'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('VendorDeliveries', {
      id:             { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      vendorId:       { type: Sequelize.INTEGER, allowNull: false, references: { model: 'Vendors', key: 'id' }, onDelete: 'CASCADE', onUpdate: 'CASCADE' },
      date:           { type: Sequelize.DATEONLY, allowNull: false },
      deliveryNoteId: { type: Sequelize.INTEGER, allowNull: true, references: { model: 'DeliveryNotes', key: 'id' }, onDelete: 'SET NULL', onUpdate: 'CASCADE' },
      videoLink:      { type: Sequelize.TEXT, allowNull: true },
      notes:          { type: Sequelize.TEXT, allowNull: true },
      createdBy:      { type: Sequelize.INTEGER, allowNull: false, references: { model: 'Users', key: 'id' }, onDelete: 'CASCADE', onUpdate: 'CASCADE' },
      companyId:      { type: Sequelize.INTEGER, allowNull: true },
      createdAt:      { type: Sequelize.DATE, allowNull: false },
      updatedAt:      { type: Sequelize.DATE, allowNull: false },
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('VendorDeliveries');
  },
};
