'use strict';

// Poin lama jam kerja + batas menit tiap tier, semuanya configurable per
// company. Bobot default 0 supaya skor leaderboard company yang sudah jalan
// tidak berubah sampai adminnya sendiri menyalakan komponen durasi kerja.
const COLUMNS = [
  ['workDurationWeight',  0],  // persen porsi durasi kerja di skor harian
  ['scoreWorkFull',      100], // durasi kerja >= target minWorkMinutes
  ['scoreWorkTier1',      90], // kurang sampai workShortTier1Max menit
  ['scoreWorkTier2',      80], // kurang sampai workShortTier2Max menit
  ['scoreWorkTier3',      70], // kurang lebih dari workShortTier2Max menit
  ['lateTier1Max',        29], // batas menit telat tier 1
  ['lateTier2Max',        45], // batas menit telat tier 2
  ['lateTier3Max',        60], // batas menit telat tier 3
  ['workShortTier1Max',   29], // batas menit kekurangan durasi tier 1
  ['workShortTier2Max',   60], // batas menit kekurangan durasi tier 2
];

module.exports = {
  async up(queryInterface, Sequelize) {
    for (const [name, defaultValue] of COLUMNS) {
      await queryInterface.addColumn('HrisSettings', name, {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue,
      });
    }
  },

  async down(queryInterface) {
    for (const [name] of COLUMNS.slice().reverse()) {
      await queryInterface.removeColumn('HrisSettings', name);
    }
  },
};
