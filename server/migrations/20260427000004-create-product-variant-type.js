'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('ProductVariantTypes', {
      id:        { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      ProductId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Products', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      name:      { type: Sequelize.STRING, allowNull: false }, // e.g., "Ukuran", "Warna"
      companyId: { type: Sequelize.INTEGER, allowNull: true },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('ProductVariantTypes');
  }
};
