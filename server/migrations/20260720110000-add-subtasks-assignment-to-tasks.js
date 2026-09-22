'use strict';
module.exports = {
  async up(queryInterface, DataTypes) {
    await queryInterface.addColumn('Tasks', 'parentTaskId', {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: 'Tasks', key: 'id' },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    });
    await queryInterface.addColumn('Tasks', 'assignmentStatus', {
      type: DataTypes.ENUM('PENDING', 'ACCEPTED', 'REJECTED'),
      allowNull: true,
    });
    await queryInterface.addColumn('Tasks', 'assignmentNote', {
      type: DataTypes.TEXT,
      allowNull: true,
    });
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('Tasks', 'parentTaskId');
    await queryInterface.removeColumn('Tasks', 'assignmentStatus');
    await queryInterface.removeColumn('Tasks', 'assignmentNote');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_Tasks_assignmentStatus";');
  },
};
