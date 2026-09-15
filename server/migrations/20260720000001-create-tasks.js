'use strict';
module.exports = {
  async up(queryInterface, DataTypes) {
    await queryInterface.createTable('Tasks', {
      id:          { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      companyId:   { type: DataTypes.INTEGER, allowNull: true },
      title:       { type: DataTypes.STRING(255), allowNull: false },
      description: { type: DataTypes.TEXT, allowNull: true },
      status:      { type: DataTypes.ENUM('TODO', 'IN_PROGRESS', 'DONE'), allowNull: false, defaultValue: 'TODO' },
      priority:    { type: DataTypes.ENUM('LOW', 'MEDIUM', 'HIGH'), allowNull: false, defaultValue: 'MEDIUM' },
      dueDate:     { type: DataTypes.DATEONLY, allowNull: true },
      assigneeId:  { type: DataTypes.INTEGER, allowNull: true },
      createdBy:   { type: DataTypes.INTEGER, allowNull: false },
      createdAt:   { type: DataTypes.DATE, allowNull: false },
      updatedAt:   { type: DataTypes.DATE, allowNull: false },
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('Tasks');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_Tasks_status";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_Tasks_priority";');
  },
};
