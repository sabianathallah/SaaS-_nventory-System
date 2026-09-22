'use strict';
// Same rule as the app-level skipWeekend() fix in taskController.js, applied
// retroactively: a Daily-recurrence task whose dueDate/myDayDate already
// landed on a Saturday/Sunday (set before that fix existed) gets rolled
// forward to the following Monday — rescheduled, never deleted.
module.exports = {
  async up(queryInterface) {
    const q = queryInterface.sequelize;
    const rollToMonday = (col) => `
      "${col}" + (
        CASE WHEN EXTRACT(DOW FROM "${col}") = 6 THEN 2
             WHEN EXTRACT(DOW FROM "${col}") = 0 THEN 1
             ELSE 0 END
      ) * INTERVAL '1 day'
    `;
    await q.query(`
      UPDATE "Tasks"
      SET "dueDate" = (${rollToMonday('dueDate')})::date
      WHERE "recurrence" = 'DAILY' AND "dueDate" IS NOT NULL AND EXTRACT(DOW FROM "dueDate") IN (0, 6);
    `);
    await q.query(`
      UPDATE "Tasks"
      SET "myDayDate" = (${rollToMonday('myDayDate')})::date
      WHERE "recurrence" = 'DAILY' AND "myDayDate" IS NOT NULL AND "status" != 'DONE'
        AND EXTRACT(DOW FROM "myDayDate") IN (0, 6);
    `);
  },
  async down() {
    // Data-fix only — rolling weekend dates back would just reintroduce the
    // thing this migration exists to fix.
  },
};
