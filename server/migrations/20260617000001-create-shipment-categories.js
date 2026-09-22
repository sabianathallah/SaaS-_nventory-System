'use strict';
module.exports = {
  async up(queryInterface, DataTypes) {
    await queryInterface.createTable('ShipmentCategories', {
      id:        { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      companyId: { type: DataTypes.INTEGER, allowNull: true },
      name:      { type: DataTypes.STRING(100), allowNull: false },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false },
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('ShipmentCategories');
  },
};
