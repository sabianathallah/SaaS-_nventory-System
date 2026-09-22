'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('RequestItems', 'shippedQty', {
      type: Sequelize.INTEGER,
      allowNull: true,
      defaultValue: null,
    });
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('RequestItems', 'shippedQty');
  },
};
