'use strict';

module.exports = {
  async up(queryInterface) {
    const q = (sql) => queryInterface.sequelize.query(sql);

    await q(`ALTER TABLE "Requests" ALTER COLUMN status DROP DEFAULT;`);
    await q(`ALTER TABLE "Requests" ALTER COLUMN status TYPE TEXT USING status::TEXT;`);
    await q(`DROP TYPE IF EXISTS "enum_Requests_status";`);
    await q(`CREATE TYPE "enum_Requests_status" AS ENUM('DRAFT','PENDING','APPROVED','REJECTED','SENT','DONE');`);
    await q(`ALTER TABLE "Requests" ALTER COLUMN status TYPE "enum_Requests_status" USING status::"enum_Requests_status";`);
    await q(`ALTER TABLE "Requests" ALTER COLUMN status SET DEFAULT 'PENDING';`);
  },

  async down(queryInterface) {
    const q = (sql) => queryInterface.sequelize.query(sql);

    // Hapus semua draft sebelum rollback (tidak bisa hapus nilai dari ENUM kalau masih ada data)
    await q(`DELETE FROM "RequestItems" WHERE "requestId" IN (SELECT id FROM "Requests" WHERE status = 'DRAFT');`);
    await q(`DELETE FROM "Requests" WHERE status = 'DRAFT';`);

    await q(`ALTER TABLE "Requests" ALTER COLUMN status DROP DEFAULT;`);
    await q(`ALTER TABLE "Requests" ALTER COLUMN status TYPE TEXT USING status::TEXT;`);
    await q(`DROP TYPE IF EXISTS "enum_Requests_status";`);
    await q(`CREATE TYPE "enum_Requests_status" AS ENUM('PENDING','APPROVED','REJECTED','SENT','DONE');`);
    await q(`ALTER TABLE "Requests" ALTER COLUMN status TYPE "enum_Requests_status" USING status::"enum_Requests_status";`);
    await q(`ALTER TABLE "Requests" ALTER COLUMN status SET DEFAULT 'PENDING';`);
  },
};
