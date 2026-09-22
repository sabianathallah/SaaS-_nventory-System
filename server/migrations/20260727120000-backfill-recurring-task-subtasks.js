'use strict';
// One-time backfill for the bug fixed alongside this migration: recurring
// tasks that were renewed *before* the fix in taskController.js never got
// their sub-tasks cloned onto the new occurrence. For every currently-open
// top-level recurring task with zero sub-tasks, find the most recent DONE
// occurrence with the same title/recurrence/company/divisi/list that still
// has its (completed) sub-tasks, and clone those onto the open task reset
// to TODO — mirrors exactly what the app-level fix now does automatically.
// Additive only: never touches or deletes the old completed task/sub-tasks.
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      DO $$
      DECLARE
        rec RECORD;
        predecessor_id INTEGER;
        sub RECORD;
        new_sub_id INTEGER;
      BEGIN
        FOR rec IN
          SELECT t.id, t.title, t.recurrence, t."companyId", t.divisi, t."listId", t."createdAt"
          FROM "Tasks" t
          WHERE t."parentTaskId" IS NULL
            AND t.recurrence <> 'NONE'
            AND t.status <> 'DONE'
            AND NOT EXISTS (SELECT 1 FROM "Tasks" st WHERE st."parentTaskId" = t.id)
        LOOP
          SELECT p.id INTO predecessor_id
          FROM "Tasks" p
          WHERE p.title = rec.title
            AND p.recurrence = rec.recurrence
            AND p."companyId" IS NOT DISTINCT FROM rec."companyId"
            AND p.divisi IS NOT DISTINCT FROM rec.divisi
            AND p."listId" IS NOT DISTINCT FROM rec."listId"
            AND p.status = 'DONE'
            AND p."parentTaskId" IS NULL
            AND p.id <> rec.id
            AND p."createdAt" < rec."createdAt"
            AND EXISTS (SELECT 1 FROM "Tasks" st WHERE st."parentTaskId" = p.id)
          ORDER BY p."createdAt" DESC
          LIMIT 1;

          IF predecessor_id IS NOT NULL THEN
            FOR sub IN SELECT * FROM "Tasks" WHERE "parentTaskId" = predecessor_id LOOP
              INSERT INTO "Tasks"
                (title, description, status, priority, "dueDate", "myDayDate", "createdBy", "companyId", divisi, "listId", tags, recurrence, "parentTaskId", "createdAt", "updatedAt")
              VALUES
                (sub.title, sub.description, 'TODO', sub.priority, NULL, NULL, sub."createdBy", sub."companyId", sub.divisi, sub."listId", sub.tags, 'NONE', rec.id, NOW(), NOW())
              RETURNING id INTO new_sub_id;

              INSERT INTO "TaskAssignees" ("taskId", "userId", "assignmentStatus", "assignmentNote", "createdAt", "updatedAt")
              SELECT new_sub_id, ta."userId", ta."assignmentStatus", ta."assignmentNote", NOW(), NOW()
              FROM "TaskAssignees" ta
              WHERE ta."taskId" = sub.id;
            END LOOP;
          END IF;

          predecessor_id := NULL;
        END LOOP;
      END $$;
    `);
  },
  async down() {
    // Data-fix only — no reliable way to distinguish backfilled sub-tasks
    // from legitimately created ones, so this is not reversible.
  },
};
