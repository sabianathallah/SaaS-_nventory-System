'use strict';
// Postgres enums can't have a value removed with a plain ALTER TYPE, so the
// column type has to be swapped for a freshly-created one — recreate the
// type with the new value set, backfilling any existing WEEKDAYS rows to
// DAILY (closest surviving cadence) before the cast.
module.exports = {
  async up(queryInterface) {
    const q = queryInterface.sequelize;
    await q.query('ALTER TYPE "enum_Tasks_recurrence" RENAME TO "enum_Tasks_recurrence_old";');
    await q.query(`CREATE TYPE "enum_Tasks_recurrence" AS ENUM('NONE', 'DAILY', 'WEEKLY', 'MONTHLY');`);
    await q.query(`UPDATE "Tasks" SET "recurrence" = 'DAILY' WHERE "recurrence" = 'WEEKDAYS';`);
    await q.query('ALTER TABLE "Tasks" ALTER COLUMN "recurrence" DROP DEFAULT;');
    await q.query(`ALTER TABLE "Tasks" ALTER COLUMN "recurrence" TYPE "enum_Tasks_recurrence" USING ("recurrence"::text::"enum_Tasks_recurrence");`);
    await q.query(`ALTER TABLE "Tasks" ALTER COLUMN "recurrence" SET DEFAULT 'NONE';`);
    await q.query('DROP TYPE "enum_Tasks_recurrence_old";');
  },
  async down(queryInterface) {
    const q = queryInterface.sequelize;
    await q.query('ALTER TYPE "enum_Tasks_recurrence" RENAME TO "enum_Tasks_recurrence_new";');
    await q.query(`CREATE TYPE "enum_Tasks_recurrence" AS ENUM('NONE', 'DAILY', 'WEEKDAYS', 'WEEKLY');`);
    await q.query(`UPDATE "Tasks" SET "recurrence" = 'WEEKLY' WHERE "recurrence" = 'MONTHLY';`);
    await q.query('ALTER TABLE "Tasks" ALTER COLUMN "recurrence" DROP DEFAULT;');
    await q.query(`ALTER TABLE "Tasks" ALTER COLUMN "recurrence" TYPE "enum_Tasks_recurrence" USING ("recurrence"::text::"enum_Tasks_recurrence");`);
    await q.query(`ALTER TABLE "Tasks" ALTER COLUMN "recurrence" SET DEFAULT 'NONE';`);
    await q.query('DROP TYPE "enum_Tasks_recurrence_new";');
  },
};
