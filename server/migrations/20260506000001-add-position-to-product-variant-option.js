'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('ProductVariantOptions');
    if (!table.position) {
      await queryInterface.addColumn('ProductVariantOptions', 'position', {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      });
      await queryInterface.sequelize.query(`
        UPDATE "ProductVariantOptions" po
        SET position = sub.row_num - 1
        FROM (
          SELECT id, ROW_NUMBER() OVER (PARTITION BY "ProductVariantTypeId" ORDER BY id) AS row_num
          FROM "ProductVariantOptions"
        ) sub
        WHERE po.id = sub.id
      `);
    }
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('ProductVariantOptions', 'position');
  },
};
