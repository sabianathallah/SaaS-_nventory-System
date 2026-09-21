'use strict';
module.exports = {
  // "Lists" (satu lapis pengelompokan di dalam folder divisi) tidak pernah
  // dipakai sejak dirilis — 0 baris TaskLists dan 0 task ber-listId di
  // produksi — dan perannya sekarang diambil alih oleh Projects, yang lintas
  // divisi dan punya status/PIC/progres. Fiturnya dipensiunkan supaya tidak
  // ada tiga lapis pengelompokan untuk satu set task.
  async up(queryInterface) {
    await queryInterface.removeColumn('Tasks', 'listId');
    await queryInterface.dropTable('TaskLists');
  },
  // Mengembalikan strukturnya saja — isi tabelnya (yang memang kosong saat
  // migrasi ini dibuat) tidak ikut dipulihkan.
  async down(queryInterface, Sequelize) {
    await queryInterface.createTable('TaskLists', {
      id:        { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      companyId: { type: Sequelize.INTEGER, allowNull: true },
      userId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Users', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      divisi:    { type: Sequelize.STRING(100), allowNull: true },
      name:      { type: Sequelize.STRING(100), allowNull: false },
      color:     { type: Sequelize.STRING(20), allowNull: false, defaultValue: '#C8102E' },
      icon:      { type: Sequelize.STRING(50), allowNull: true },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addColumn('Tasks', 'listId', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: 'TaskLists', key: 'id' },
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE',
    });
  },
};
