'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Users', 'shiftId', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: 'Shifts', key: 'id' },
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('Users', 'shiftId');
  },
};
