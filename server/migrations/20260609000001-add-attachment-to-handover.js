'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Handovers', 'attachment_url', {
      type: Sequelize.STRING(500),
      allowNull: true,
    });
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('Handovers', 'attachment_url');
  },
};
