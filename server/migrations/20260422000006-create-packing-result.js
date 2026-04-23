'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('PackingResults', {
      id:                  { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      PackingJobId:        { type: Sequelize.INTEGER, allowNull: false, references: { model: 'PackingJobs', key: 'id' }, onDelete: 'CASCADE', onUpdate: 'CASCADE' },
      IncomingGoodsItemId: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'IncomingGoodsItems', key: 'id' }, onDelete: 'CASCADE', onUpdate: 'CASCADE' },
      qtyReady:            { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      qtyReject:           { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      rejectReason:        { type: Sequelize.TEXT, allowNull: true },
      scannedBarcode:      { type: Sequelize.STRING(255), allowNull: true },
      submittedBy:         { type: Sequelize.INTEGER, allowNull: false, references: { model: 'Users', key: 'id' }, onDelete: 'CASCADE', onUpdate: 'CASCADE' },
      companyId:           { type: Sequelize.INTEGER, allowNull: true },
      createdAt:           { type: Sequelize.DATE, allowNull: false },
      updatedAt:           { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.addConstraint('PackingResults', {
      fields: ['PackingJobId', 'IncomingGoodsItemId'],
      type: 'unique',
      name: 'unique_packing_result_per_item',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('PackingResults');
  },
};
