'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Stock_Movements', 'date', {
      type: Sequelize.DATE,
      allowNull: true,
    });
    await queryInterface.sequelize.query(
      `UPDATE "Stock_Movements" SET "date" = "createdAt" WHERE "date" IS NULL`
    );
    await queryInterface.changeColumn('Stock_Movements', 'date', {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.NOW,
    });
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('Stock_Movements', 'date');
  },
};
