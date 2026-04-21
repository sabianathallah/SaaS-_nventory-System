'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addConstraint('Stocks', {
      fields: ['ProductId', 'WarehouseId'],
      type: 'unique',
      name: 'unique_stock_product_warehouse'
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.removeConstraint('Stocks', 'unique_stock_product_warehouse');
  }
};
