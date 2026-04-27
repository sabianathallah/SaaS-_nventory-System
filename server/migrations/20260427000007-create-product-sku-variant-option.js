'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('ProductSKUVariantOptions', {
      id:                    { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      ProductSKUId:          {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'ProductSKUs', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      ProductVariantOptionId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'ProductVariantOptions', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('ProductSKUVariantOptions');
  }
};
