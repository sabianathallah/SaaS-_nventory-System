'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Products', 'ArticleId', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: 'Articles', key: 'id' },
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE',
    });
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('Products', 'ArticleId');
  }
};
