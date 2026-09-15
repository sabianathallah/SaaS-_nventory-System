'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Stock_Out_Headers', 'ChannelId', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: 'Channels', key: 'id' },
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE',
    });
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('Stock_Out_Headers', 'ChannelId');
  },
};
