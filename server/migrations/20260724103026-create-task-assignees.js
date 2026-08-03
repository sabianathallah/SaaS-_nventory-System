'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('TaskAssignees', {
      id:     { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      taskId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Tasks', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      userId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Users', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      assignmentStatus: {
        type: Sequelize.ENUM('PENDING', 'ACCEPTED', 'REJECTED'),
        allowNull: true,
      },
      assignmentNote: { type: Sequelize.TEXT, allowNull: true },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addConstraint('TaskAssignees', {
      fields: ['taskId', 'userId'],
      type: 'unique',
      name: 'task_assignees_task_user_unique',
    });

    // Migrate existing single-assignee data into the join table.
    await queryInterface.sequelize.query(`
      INSERT INTO "TaskAssignees" ("taskId", "userId", "assignmentStatus", "assignmentNote", "createdAt", "updatedAt")
      SELECT "id", "assigneeId", "assignmentStatus"::text::"enum_TaskAssignees_assignmentStatus", "assignmentNote", NOW(), NOW()
      FROM "Tasks"
      WHERE "assigneeId" IS NOT NULL
    `);

    await queryInterface.removeColumn('Tasks', 'assigneeId');
    await queryInterface.removeColumn('Tasks', 'assignmentStatus');
    await queryInterface.removeColumn('Tasks', 'assignmentNote');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_Tasks_assignmentStatus";');
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.addColumn('Tasks', 'assigneeId', { type: Sequelize.INTEGER, allowNull: true });
    await queryInterface.addColumn('Tasks', 'assignmentStatus', {
      type: Sequelize.ENUM('PENDING', 'ACCEPTED', 'REJECTED'),
      allowNull: true,
    });
    await queryInterface.addColumn('Tasks', 'assignmentNote', { type: Sequelize.TEXT, allowNull: true });

    // Best-effort restore: take one assignee row per task (last one).
    await queryInterface.sequelize.query(`
      UPDATE "Tasks" t
      SET "assigneeId" = sub."userId",
          "assignmentStatus" = sub."assignmentStatus",
          "assignmentNote" = sub."assignmentNote"
      FROM (
        SELECT DISTINCT ON ("taskId") "taskId", "userId", "assignmentStatus", "assignmentNote"
        FROM "TaskAssignees"
        ORDER BY "taskId", "id" DESC
      ) sub
      WHERE t."id" = sub."taskId"
    `);

    await queryInterface.dropTable('TaskAssignees');
  },
};
