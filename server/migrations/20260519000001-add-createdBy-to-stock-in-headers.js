'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Stock_In_Headers', 'createdBy', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: 'Users', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('Stock_In_Headers', 'createdBy');
  },
};
