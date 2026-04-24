'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const cols = await queryInterface.describeTable('Products');
    if (!cols.imageUrl) {
      await queryInterface.addColumn('Products', 'imageUrl', {
        type: Sequelize.TEXT,
        allowNull: true,
      });
    }
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('Products', 'imageUrl').catch(() => {});
  },
};
