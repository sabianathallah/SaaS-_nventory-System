'use strict';

// Setting tambahan: apresiasi lembur, dan minimum hari untuk masuk leaderboard.
const SETTING_COLUMNS = [
  ['scoreWorkOvertime',      100], // default sama dengan durasi penuh = tanpa bonus
  ['workOvertimeMinMinutes',  60], // lebih dari target sebanyak ini baru dianggap lembur
  ['leaderboardMinDays',      10], // minimum hari terhitung untuk masuk papan skor
];

module.exports = {
  async up(queryInterface, Sequelize) {
    for (const [name, defaultValue] of SETTING_COLUMNS) {
      await queryInterface.addColumn('HrisSettings', name, {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue,
      });
    }

    // Jam pulang hasil cron auto check-out (lupa check-out) bukan jam pulang
    // sebenarnya, jadi ditandai supaya poin durasinya tidak dihitung penuh.
    await queryInterface.addColumn('Attendances', 'autoCheckOut', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });

    // Skor harian dibekukan saat harinya ditutup, supaya mengubah kebijakan
    // poin tidak mengubah ranking bulan-bulan yang sudah lewat.
    // scoreSnapshotAt terisi + scoreSnapshot NULL = hari netral (cuti/sakit).
    await queryInterface.addColumn('Attendances', 'scoreSnapshot', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });
    await queryInterface.addColumn('Attendances', 'scoreSnapshotAt', {
      type: Sequelize.DATE,
      allowNull: true,
    });

    // Jejak audit perubahan kebijakan poin — angka ini menilai orang, jadi
    // harus jelas siapa mengubah apa dan kapan.
    await queryInterface.createTable('HrisSettingLogs', {
      id:        { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      companyId: { type: Sequelize.INTEGER, allowNull: true },
      changedBy: { type: Sequelize.INTEGER, allowNull: true },
      changes:   { type: Sequelize.JSON, allowNull: false },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('HrisSettingLogs', ['companyId', 'createdAt']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('HrisSettingLogs');
    await queryInterface.removeColumn('Attendances', 'scoreSnapshotAt');
    await queryInterface.removeColumn('Attendances', 'scoreSnapshot');
    await queryInterface.removeColumn('Attendances', 'autoCheckOut');
    for (const [name] of SETTING_COLUMNS.slice().reverse()) {
      await queryInterface.removeColumn('HrisSettings', name);
    }
  },
};
