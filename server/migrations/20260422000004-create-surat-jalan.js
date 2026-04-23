'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('SuratJalans', {
      id:              { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      sjNumber:        { type: Sequelize.STRING(100), allowNull: false, unique: true },
      IncomingGoodsId: { type: Sequelize.INTEGER, allowNull: false, unique: true, references: { model: 'IncomingGoods', key: 'id' }, onDelete: 'CASCADE', onUpdate: 'CASCADE' },
      generatedBy:     { type: Sequelize.INTEGER, allowNull: false, references: { model: 'Users', key: 'id' }, onDelete: 'CASCADE', onUpdate: 'CASCADE' },
      generatedAt:     { type: Sequelize.DATE, allowNull: false },
      printedAt:       { type: Sequelize.DATE, allowNull: true },
      snapshotItems:   { type: Sequelize.JSONB, allowNull: false, defaultValue: [] },
      notes:           { type: Sequelize.TEXT, allowNull: true },
      companyId:       { type: Sequelize.INTEGER, allowNull: true },
      createdAt:       { type: Sequelize.DATE, allowNull: false },
      updatedAt:       { type: Sequelize.DATE, allowNull: false },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('SuratJalans');
  },
};
