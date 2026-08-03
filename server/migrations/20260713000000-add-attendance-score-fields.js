'use strict';

// Semua nilai skor leaderboard configurable per company. Tier waktu kedatangan
// relatif ke jam mulai shift (contoh shift 09:00): <=09:00, 09:01-09:29,
// 09:30-09:45, 09:46-10:00, >10:00.
const SCORE_COLUMNS = [
  ['scoreOnTime',       100], // datang <= jam mulai shift
  ['scoreLateTier1',     90], // telat 1-29 menit
  ['scoreLateTier2',     85], // telat 30-45 menit
  ['scoreLateTier3',     80], // telat 46-60 menit
  ['scoreLateTier4',     75], // telat > 60 menit
  ['scoreLateExcused',   70], // izin telat approved (status hadir)
  ['scoreHalfDay',       50], // setengah hari
  ['fieldPendingScore',  75], // hari FIELD selama masih PENDING_REVIEW
];

module.exports = {
  async up(queryInterface, Sequelize) {
    // Skor manual dari reviewer untuk klaim FIELD yang di-approve tapi
    // karyawannya belum sampai vendor saat absen. NULL = dihitung normal.
    await queryInterface.addColumn('Attendances', 'fieldScore', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });
    for (const [name, defaultValue] of SCORE_COLUMNS) {
      await queryInterface.addColumn('HrisSettings', name, {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue,
      });
    }
  },

  async down(queryInterface) {
    for (const [name] of SCORE_COLUMNS.slice().reverse()) {
      await queryInterface.removeColumn('HrisSettings', name);
    }
    await queryInterface.removeColumn('Attendances', 'fieldScore');
  },
};
