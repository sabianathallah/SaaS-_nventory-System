'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    // Add SJ fields to VendorDeliveries
    await queryInterface.addColumn('VendorDeliveries', 'sjNumber', { type: Sequelize.STRING, allowNull: true });
    await queryInterface.addColumn('VendorDeliveries', 'sjPhoto',  { type: Sequelize.TEXT,   allowNull: true });

    // Explicitly drop FK constraint before removing column (PostgreSQL requires this)
    await queryInterface.sequelize.query(
      'ALTER TABLE "VendorDeliveries" DROP CONSTRAINT IF EXISTS "VendorDeliveries_deliveryNoteId_fkey"'
    );
    await queryInterface.removeColumn('VendorDeliveries', 'deliveryNoteId');

    // Drop DeliveryNotes table
    await queryInterface.dropTable('DeliveryNotes');
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.createTable('DeliveryNotes', {
      id:        { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      date:      { type: Sequelize.DATEONLY, allowNull: false },
      photoUrl:  { type: Sequelize.TEXT, allowNull: true },
      companyId: { type: Sequelize.INTEGER, allowNull: true },
      createdBy: { type: Sequelize.INTEGER, allowNull: true },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addColumn('VendorDeliveries', 'deliveryNoteId', { type: Sequelize.INTEGER, allowNull: true });
    await queryInterface.removeColumn('VendorDeliveries', 'sjNumber');
    await queryInterface.removeColumn('VendorDeliveries', 'sjPhoto');
  },
};
