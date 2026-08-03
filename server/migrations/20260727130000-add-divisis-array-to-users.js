'use strict';
// Users used to have exactly one divisi (single STRING column, still kept
// for back-compat display/reports). This adds `divisis` — a JSON array
// letting a user belong to more than one — backfilled from the existing
// single value so nobody loses their current division on upgrade.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Users', 'divisis', {
      type: Sequelize.JSON,
      allowNull: false,
      defaultValue: [],
    });
    await queryInterface.sequelize.query(`
      UPDATE "Users"
      SET "divisis" = to_jsonb(ARRAY["divisi"])
      WHERE "divisi" IS NOT NULL AND trim("divisi") <> '';
    `);
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('Users', 'divisis');
  },
};
