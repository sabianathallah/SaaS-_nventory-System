'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    // A task belongs to at most one project (single relation, like Notion's
    // default Project property) — deleting a project releases its tasks
    // instead of taking them down with it.
    await queryInterface.addColumn('Tasks', 'projectId', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: 'Projects', key: 'id' },
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE',
    });
    await queryInterface.addIndex('Tasks', ['projectId']);
  },
  async down(queryInterface) {
    await queryInterface.removeIndex('Tasks', ['projectId']);
    await queryInterface.removeColumn('Tasks', 'projectId');
  },
};
