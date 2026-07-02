'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Stock_Out_Drafts', 'sourceRequestId', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });
    await queryInterface.addColumn('Requests', 'stockOutDraftId', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('Stock_Out_Drafts', 'sourceRequestId');
    await queryInterface.removeColumn('Requests', 'stockOutDraftId');
  },
};
