'use strict';

module.exports = {
  async up(queryInterface) {
    const q = (sql) => queryInterface.sequelize.query(sql);

    await q(`ALTER TABLE "ManualShipments" ALTER COLUMN status DROP DEFAULT;`);
    await q(`ALTER TABLE "ManualShipments" ALTER COLUMN status TYPE TEXT USING status::TEXT;`);
    await q(`DROP TYPE IF EXISTS "enum_ManualShipments_status";`);
    await q(`CREATE TYPE "enum_ManualShipments_status" AS ENUM('draft','pending','paid','shipped','completed','cancelled');`);
    await q(`ALTER TABLE "ManualShipments" ALTER COLUMN status TYPE "enum_ManualShipments_status" USING status::"enum_ManualShipments_status";`);
    await q(`ALTER TABLE "ManualShipments" ALTER COLUMN status SET DEFAULT 'draft';`);
  },

  async down(queryInterface) {
    const q = (sql) => queryInterface.sequelize.query(sql);

    // Hapus semua draft sebelum rollback (tidak bisa hapus nilai dari ENUM kalau masih ada data)
    await q(`UPDATE "ManualShipments" SET status = 'cancelled' WHERE status = 'draft';`);

    await q(`ALTER TABLE "ManualShipments" ALTER COLUMN status DROP DEFAULT;`);
    await q(`ALTER TABLE "ManualShipments" ALTER COLUMN status TYPE TEXT USING status::TEXT;`);
    await q(`DROP TYPE IF EXISTS "enum_ManualShipments_status";`);
    await q(`CREATE TYPE "enum_ManualShipments_status" AS ENUM('pending','paid','shipped','completed','cancelled');`);
    await q(`ALTER TABLE "ManualShipments" ALTER COLUMN status TYPE "enum_ManualShipments_status" USING status::"enum_ManualShipments_status";`);
    await q(`ALTER TABLE "ManualShipments" ALTER COLUMN status SET DEFAULT 'pending';`);
  },
};
