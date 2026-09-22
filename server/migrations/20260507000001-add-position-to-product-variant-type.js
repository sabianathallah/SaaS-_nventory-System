'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('ProductVariantTypes');
    if (!table.position) {
      await queryInterface.addColumn('ProductVariantTypes', 'position', {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      });
      await queryInterface.sequelize.query(`
        UPDATE "ProductVariantTypes" pvt
        SET position = sub.row_num - 1
        FROM (
          SELECT id, ROW_NUMBER() OVER (PARTITION BY "ProductId" ORDER BY "createdAt") AS row_num
          FROM "ProductVariantTypes"
        ) sub
        WHERE pvt.id = sub.id
      `);
    }
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('ProductVariantTypes', 'position');
  },
};
