'use strict';
const TYPES = ['Endorse', 'Early Access', 'Photoshoot', 'Sales', 'Lainnya'];

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    // Seed for each company + one null (system-wide fallback)
    const companies = await queryInterface.sequelize.query(
      'SELECT id FROM "Companies"',
      { type: queryInterface.sequelize.QueryTypes.SELECT }
    );
    const rows = [];
    for (const c of companies) {
      for (const name of TYPES) {
        rows.push({ name, companyId: c.id, isActive: true, createdAt: now, updatedAt: now });
      }
    }
    if (rows.length) await queryInterface.bulkInsert('RequestTypes', rows);
  },
  async down(queryInterface) {
    await queryInterface.bulkDelete('RequestTypes', null, {});
  },
};
