'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Products', 'SubCategoryId', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: 'SubCategories', key: 'id' },
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE',
    });
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('Products', 'SubCategoryId');
  }
};
