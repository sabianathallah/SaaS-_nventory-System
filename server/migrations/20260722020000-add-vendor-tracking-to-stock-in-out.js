'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const VENDOR_FK   = { type: Sequelize.INTEGER, allowNull: true, references: { model: 'Vendors', key: 'id' }, onDelete: 'SET NULL', onUpdate: 'CASCADE' };
    const DELIVERY_FK = { type: Sequelize.INTEGER, allowNull: true, references: { model: 'VendorDeliveries', key: 'id' }, onDelete: 'SET NULL', onUpdate: 'CASCADE' };

    await queryInterface.addColumn('Stock_In_Headers', 'VendorId', VENDOR_FK);
    await queryInterface.addColumn('Stock_In_Headers', 'sourceDeliveryId', DELIVERY_FK);

    await queryInterface.addColumn('Stock_Out_Headers', 'VendorId', VENDOR_FK);
    await queryInterface.addColumn('Stock_Out_Headers', 'sourceDeliveryId', DELIVERY_FK);
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('Stock_In_Headers', 'VendorId');
    await queryInterface.removeColumn('Stock_In_Headers', 'sourceDeliveryId');
    await queryInterface.removeColumn('Stock_Out_Headers', 'VendorId');
    await queryInterface.removeColumn('Stock_Out_Headers', 'sourceDeliveryId');
  },
};
