'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Handover_Items', {
      id:          { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      HandoverId:  { type: Sequelize.INTEGER, allowNull: false, references: { model: 'Handovers', key: 'id' }, onDelete: 'CASCADE', onUpdate: 'CASCADE' },
      resi:        { type: Sequelize.STRING(200), allowNull: false },
      scannedAt:   { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      companyId:   { type: Sequelize.INTEGER, allowNull: true },
      createdAt:   { type: Sequelize.DATE, allowNull: false },
      updatedAt:   { type: Sequelize.DATE, allowNull: false },
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('Handover_Items');
  },
};
