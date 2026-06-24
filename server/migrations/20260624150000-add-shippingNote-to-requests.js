'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Requests', 'shippingNote', {
      type: Sequelize.TEXT,
      allowNull: true,
      defaultValue: null,
    });
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('Requests', 'shippingNote');
  },
};
