'use strict';
module.exports = {
  async up(queryInterface, DataTypes) {
    await queryInterface.addColumn('Tasks', 'listId', {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: 'TaskLists', key: 'id' },
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE',
    });
    await queryInterface.addColumn('Tasks', 'tags', {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: [],
    });
    await queryInterface.addColumn('Tasks', 'reminderAt', {
      type: DataTypes.DATE,
      allowNull: true,
    });
    await queryInterface.addColumn('Tasks', 'reminderSentAt', {
      type: DataTypes.DATE,
      allowNull: true,
    });
    await queryInterface.addColumn('Tasks', 'recurrence', {
      type: DataTypes.ENUM('NONE', 'DAILY', 'WEEKDAYS', 'WEEKLY'),
      allowNull: false,
      defaultValue: 'NONE',
    });
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('Tasks', 'listId');
    await queryInterface.removeColumn('Tasks', 'tags');
    await queryInterface.removeColumn('Tasks', 'reminderAt');
    await queryInterface.removeColumn('Tasks', 'reminderSentAt');
    await queryInterface.removeColumn('Tasks', 'recurrence');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_Tasks_recurrence";');
  },
};
