'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Projects', {
      id:          { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      companyId:   { type: Sequelize.INTEGER, allowNull: true },
      name:        { type: Sequelize.STRING(150), allowNull: false },
      description: { type: Sequelize.TEXT, allowNull: true },
      color:       { type: Sequelize.STRING(20), allowNull: false, defaultValue: '#C8102E' },
      icon:        { type: Sequelize.STRING(50), allowNull: true },
      status: {
        type: Sequelize.ENUM('PLANNING', 'ACTIVE', 'ON_HOLD', 'DONE'),
        allowNull: false,
        defaultValue: 'ACTIVE',
      },
      startDate: { type: Sequelize.DATEONLY, allowNull: true },
      dueDate:   { type: Sequelize.DATEONLY, allowNull: true },
      // Project owner (PIC). Nullable so a project survives its owner being
      // removed — the row stays, the PIC column just empties out.
      ownerId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'Users', key: 'id' },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      },
      createdBy: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Users', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('Projects');
    // createTable() with an ENUM leaves the Postgres type behind on drop.
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_Projects_status";');
  },
};
