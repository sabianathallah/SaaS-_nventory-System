'use strict';

// Ganti skor flat izin telat dengan bonus di atas skor tier jam datang —
// jam datang tetap ngaruh walau izin, dan yang izin resmi selalu lebih
// tinggi dari yang telat tanpa izin di jam yang sama.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('HrisSettings', 'lateExcuseBonus', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 5,
    });
    await queryInterface.removeColumn('HrisSettings', 'scoreLateExcused');
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.addColumn('HrisSettings', 'scoreLateExcused', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 70,
    });
    await queryInterface.removeColumn('HrisSettings', 'lateExcuseBonus');
  },
};
