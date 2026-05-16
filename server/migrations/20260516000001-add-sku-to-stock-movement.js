'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Stock_Movements', 'ProductSKUId', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: 'ProductSKUs', key: 'id' },
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE',
    });
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('Stock_Movements', 'ProductSKUId');
  },
};
