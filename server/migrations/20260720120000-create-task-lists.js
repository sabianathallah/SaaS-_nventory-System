'use strict';
module.exports = {
  async up(queryInterface, DataTypes) {
    await queryInterface.createTable('TaskLists', {
      id:        { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      companyId: { type: DataTypes.INTEGER, allowNull: true },
      userId:    { type: DataTypes.INTEGER, allowNull: false },
      name:      { type: DataTypes.STRING(100), allowNull: false },
      color:     { type: DataTypes.STRING(20), allowNull: false, defaultValue: '#C8102E' },
      icon:      { type: DataTypes.STRING(50), allowNull: true },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false },
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('TaskLists');
  },
};
