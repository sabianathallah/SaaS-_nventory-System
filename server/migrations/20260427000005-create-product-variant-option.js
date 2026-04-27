'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('ProductVariantOptions', {
      id:                   { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      ProductVariantTypeId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'ProductVariantTypes', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      value:     { type: Sequelize.STRING, allowNull: false }, // e.g., "M", "L", "Merah"
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('ProductVariantOptions');
  }
};
