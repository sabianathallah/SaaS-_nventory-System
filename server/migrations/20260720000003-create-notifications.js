'use strict';
module.exports = {
  async up(queryInterface, DataTypes) {
    await queryInterface.createTable('Notifications', {
      id:        { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      companyId: { type: DataTypes.INTEGER, allowNull: true },
      userId:    { type: DataTypes.INTEGER, allowNull: false },
      type:      { type: DataTypes.STRING(50), allowNull: false },
      title:     { type: DataTypes.STRING(255), allowNull: false },
      message:   { type: DataTypes.STRING(500), allowNull: false },
      link:      { type: DataTypes.STRING(255), allowNull: true },
      isRead:    { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false },
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('Notifications');
  },
};
