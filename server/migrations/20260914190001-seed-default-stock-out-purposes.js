'use strict';

const DEFAULT_PURPOSES = [
  'Penjualan', 'Endorse', 'Photoshoot', 'R&D', 'Pemakaian Internal',
  'Hadiah / Gift', 'Sample', 'Retur Vendor', 'Retur Customer', 'Early Access', 'Lainnya',
];

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const companies = await queryInterface.sequelize.query(
      `SELECT id FROM "Companies"`,
      { type: queryInterface.sequelize.QueryTypes.SELECT }
    );
    for (const company of companies) {
      for (const name of DEFAULT_PURPOSES) {
        await queryInterface.sequelize.query(
          `INSERT INTO "StockOutPurposes" (name, "isActive", "companyId", "createdAt", "updatedAt")
           SELECT :name, true, :companyId, :now, :now
           WHERE NOT EXISTS (
             SELECT 1 FROM "StockOutPurposes" WHERE name = :name AND "companyId" = :companyId
           )`,
          { replacements: { name, companyId: company.id, now } }
        );
      }
    }
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(
      `DELETE FROM "StockOutPurposes" WHERE name IN (:names)`,
      { replacements: { names: DEFAULT_PURPOSES } }
    );
  },
};
