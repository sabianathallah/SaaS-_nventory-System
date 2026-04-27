'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('ProductSKUs', {
      id:        { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      ProductId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Products', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      sku_code:  { type: Sequelize.STRING, allowNull: false, unique: true },
      price:     { type: Sequelize.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
      qty:       { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      companyId: { type: Sequelize.INTEGER, allowNull: true },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('ProductSKUs');
  }
};
