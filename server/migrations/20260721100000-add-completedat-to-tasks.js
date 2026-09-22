'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Tasks', 'completedAt', {
      type: Sequelize.DATE,
      allowNull: true,
      defaultValue: null,
    });
    // Backfill dari data lama yang sudah DONE sebelum kolom ini ada, supaya
    // riwayat "selesai per minggu/bulan" di Dashboard tidak kosong untuk task
    // lama — pakai updatedAt sebagai pendekatan waktu selesai.
    await queryInterface.sequelize.query(
      `UPDATE "Tasks" SET "completedAt" = "updatedAt" WHERE "status" = 'DONE' AND "completedAt" IS NULL;`
    );
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('Tasks', 'completedAt');
  },
};
