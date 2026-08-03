'use strict';
// Data-only fix (no schema change): tasks created as DAILY recurrence before
// taskController.create/update started defaulting dueDate/myDayDate ended up
// with both null — silently invisible in "Tugas Hari Ini" and unable to ever
// auto-spawn their next occurrence (nextDueDate() requires a dueDate). Only
// fills nulls forward; never touches a dueDate/myDayDate the user already set.
module.exports = {
  async up(queryInterface) {
    const q = queryInterface.sequelize;
    await q.query(`UPDATE "Tasks" SET "dueDate" = CURRENT_DATE WHERE "recurrence" = 'DAILY' AND "dueDate" IS NULL;`);
    await q.query(`UPDATE "Tasks" SET "myDayDate" = "dueDate" WHERE "recurrence" = 'DAILY' AND "myDayDate" IS NULL AND "status" != 'DONE';`);
  },
  async down() {
    // Data-fix only — no schema to revert, and un-defaulting these fields
    // would just reintroduce the bug this migration exists to fix.
  },
};
