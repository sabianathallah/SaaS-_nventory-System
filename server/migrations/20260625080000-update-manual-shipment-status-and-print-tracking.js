'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const q = (sql) => queryInterface.sequelize.query(sql);

    // 1. Drop the DEFAULT so we can alter the column freely
    await q(`ALTER TABLE "ManualShipments" ALTER COLUMN status DROP DEFAULT;`);

    // 2. Cast column to TEXT (bypasses ENUM constraint)
    await q(`ALTER TABLE "ManualShipments" ALTER COLUMN status TYPE TEXT USING status::TEXT;`);

    // 3. Drop old ENUM type
    await q(`DROP TYPE IF EXISTS "enum_ManualShipments_status";`);

    // 4. Rename values
    await q(`UPDATE "ManualShipments" SET status = 'pending' WHERE status = 'in_progress';`);
    await q(`UPDATE "ManualShipments" SET status = 'paid'    WHERE status = 'transferred';`);

    // 5. Create new ENUM type
    await q(`CREATE TYPE "enum_ManualShipments_status" AS ENUM('pending','paid','shipped','completed','cancelled');`);

    // 6. Cast column to new ENUM
    await q(`ALTER TABLE "ManualShipments" ALTER COLUMN status TYPE "enum_ManualShipments_status" USING status::"enum_ManualShipments_status";`);

    // 7. Restore default
    await q(`ALTER TABLE "ManualShipments" ALTER COLUMN status SET DEFAULT 'pending';`);

    // 8. Add print tracking columns
    await queryInterface.addColumn('ManualShipments', 'resiPrintedAt', {
      type: Sequelize.DATE,
      allowNull: true,
    });
    await queryInterface.addColumn('ManualShipments', 'invoicePrintedAt', {
      type: Sequelize.DATE,
      allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {
    const q = (sql) => queryInterface.sequelize.query(sql);

    await queryInterface.removeColumn('ManualShipments', 'resiPrintedAt');
    await queryInterface.removeColumn('ManualShipments', 'invoicePrintedAt');

    await q(`ALTER TABLE "ManualShipments" ALTER COLUMN status DROP DEFAULT;`);
    await q(`ALTER TABLE "ManualShipments" ALTER COLUMN status TYPE TEXT USING status::TEXT;`);
    await q(`DROP TYPE IF EXISTS "enum_ManualShipments_status";`);
    await q(`UPDATE "ManualShipments" SET status = 'in_progress' WHERE status = 'pending';`);
    await q(`UPDATE "ManualShipments" SET status = 'transferred'  WHERE status = 'paid';`);
    await q(`CREATE TYPE "enum_ManualShipments_status" AS ENUM('in_progress','transferred','shipped','completed','cancelled');`);
    await q(`ALTER TABLE "ManualShipments" ALTER COLUMN status TYPE "enum_ManualShipments_status" USING status::"enum_ManualShipments_status";`);
    await q(`ALTER TABLE "ManualShipments" ALTER COLUMN status SET DEFAULT 'in_progress';`);
  },
};
