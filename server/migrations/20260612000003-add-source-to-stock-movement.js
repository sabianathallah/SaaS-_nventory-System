'use strict';
module.exports = {
  async up(queryInterface, DataTypes) {
    await queryInterface.addColumn('Stock_Movements', 'source', {
      type: DataTypes.STRING(20),
      allowNull: true,
      defaultValue: null,
    });
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('Stock_Movements', 'source');
  },
};
