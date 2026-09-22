'use strict';
const NAMES = ['Inner', 'Outer', 'Pants', 'Accessories'];

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const companies = await queryInterface.sequelize.query(
      'SELECT id FROM "Companies"',
      { type: queryInterface.sequelize.QueryTypes.SELECT }
    );
    const rows = [];
    for (const c of companies) {
      for (const name of NAMES) {
        rows.push({ name, companyId: c.id, createdAt: now, updatedAt: now });
      }
    }
    if (rows.length) await queryInterface.bulkInsert('SubCategories', rows);
  },
  async down(queryInterface) {
    await queryInterface.bulkDelete('SubCategories', { name: NAMES }, {});
  },
};
