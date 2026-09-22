'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Tasks', 'divisi', { type: Sequelize.STRING(100), allowNull: true });
    await queryInterface.addColumn('TaskLists', 'divisi', { type: Sequelize.STRING(100), allowNull: true });

    // Backfill from the owning/creating user's divisi — best-effort snapshot,
    // matches how `divisi` will be stamped on new rows going forward.
    await queryInterface.sequelize.query(`
      UPDATE "Tasks" t
      SET "divisi" = u."divisi"
      FROM "Users" u
      WHERE t."createdBy" = u."id" AND u."divisi" IS NOT NULL
    `);
    await queryInterface.sequelize.query(`
      UPDATE "TaskLists" tl
      SET "divisi" = u."divisi"
      FROM "Users" u
      WHERE tl."userId" = u."id" AND u."divisi" IS NOT NULL
    `);
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('Tasks', 'divisi');
    await queryInterface.removeColumn('TaskLists', 'divisi');
  },
};
