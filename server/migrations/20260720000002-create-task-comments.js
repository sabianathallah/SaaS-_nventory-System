'use strict';
module.exports = {
  async up(queryInterface, DataTypes) {
    await queryInterface.createTable('TaskComments', {
      id:        { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      taskId:    { type: DataTypes.INTEGER, allowNull: false },
      userId:    { type: DataTypes.INTEGER, allowNull: false },
      content:   { type: DataTypes.TEXT, allowNull: false },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false },
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('TaskComments');
  },
};
