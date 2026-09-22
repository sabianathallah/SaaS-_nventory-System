'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const q = (sql) => queryInterface.sequelize.query(sql);

    await q(`ALTER TABLE "Requests" ALTER COLUMN status DROP DEFAULT;`);
    await q(`ALTER TABLE "Requests" ALTER COLUMN status TYPE TEXT USING status::TEXT;`);
    await q(`DROP TYPE IF EXISTS "enum_Requests_status";`);
    await q(`CREATE TYPE "enum_Requests_status" AS ENUM('DRAFT','PENDING','APPROVED','REJECTED','CANCELLED','SENT','DONE');`);
    await q(`ALTER TABLE "Requests" ALTER COLUMN status TYPE "enum_Requests_status" USING status::"enum_Requests_status";`);
    await q(`ALTER TABLE "Requests" ALTER COLUMN status SET DEFAULT 'PENDING';`);

    await queryInterface.addColumn('Requests', 'cancellationReason', { type: Sequelize.TEXT, allowNull: true });
    await queryInterface.addColumn('Requests', 'cancelledAt', { type: Sequelize.DATEONLY, allowNull: true });
  },

  async down(queryInterface) {
    const q = (sql) => queryInterface.sequelize.query(sql);

    await queryInterface.removeColumn('Requests', 'cancelledAt');
    await queryInterface.removeColumn('Requests', 'cancellationReason');

    await q(`DELETE FROM "RequestItems" WHERE "requestId" IN (SELECT id FROM "Requests" WHERE status = 'CANCELLED');`);
    await q(`DELETE FROM "Requests" WHERE status = 'CANCELLED';`);

    await q(`ALTER TABLE "Requests" ALTER COLUMN status DROP DEFAULT;`);
    await q(`ALTER TABLE "Requests" ALTER COLUMN status TYPE TEXT USING status::TEXT;`);
    await q(`DROP TYPE IF EXISTS "enum_Requests_status";`);
    await q(`CREATE TYPE "enum_Requests_status" AS ENUM('DRAFT','PENDING','APPROVED','REJECTED','SENT','DONE');`);
    await q(`ALTER TABLE "Requests" ALTER COLUMN status TYPE "enum_Requests_status" USING status::"enum_Requests_status";`);
    await q(`ALTER TABLE "Requests" ALTER COLUMN status SET DEFAULT 'PENDING';`);
  },
};
