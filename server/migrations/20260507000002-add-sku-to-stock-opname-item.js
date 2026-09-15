'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('Stock_Opname_Items');
    if (!table.ProductSKUId) {
      await queryInterface.addColumn('Stock_Opname_Items', 'ProductSKUId', {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'ProductSKUs', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      });
    }
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('Stock_Opname_Items', 'ProductSKUId');
  },
};
