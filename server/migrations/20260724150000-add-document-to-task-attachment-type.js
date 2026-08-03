'use strict';
// Adding a value is safe with a plain ALTER TYPE (unlike removing one, which
// needs the recreate-the-type dance used by the recurrence enum migration).
// Postgres won't allow ADD VALUE inside the same transaction as its use, but
// that's only a concern within this migration itself.
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`ALTER TYPE "enum_TaskAttachments_type" ADD VALUE IF NOT EXISTS 'DOCUMENT';`);
  },
  async down() {
    // Postgres can't drop a single enum value without recreating the type;
    // left as a no-op since rolling back would require migrating any
    // DOCUMENT rows first (destructive/data-dependent — better done by hand).
  },
};
