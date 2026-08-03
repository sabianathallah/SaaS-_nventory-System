'use strict';

module.exports = {
  async up(queryInterface, DataTypes) {
    await queryInterface.addColumn('ManualShipments', 'paymentProofUrls', {
      type: DataTypes.JSONB, allowNull: false, defaultValue: [],
    });
    // Backfill bukti lama sebagai entry pertama di array
    await queryInterface.sequelize.query(`
      UPDATE "ManualShipments"
      SET "paymentProofUrls" = jsonb_build_array(
        jsonb_build_object('url', "paymentProofUrl", 'uploadedAt', "updatedAt", 'uploadedBy', NULL)
      )
      WHERE "paymentProofUrl" IS NOT NULL
    `);
    await queryInterface.removeColumn('ManualShipments', 'paymentProofUrl');
  },

  async down(queryInterface, DataTypes) {
    await queryInterface.addColumn('ManualShipments', 'paymentProofUrl', {
      type: DataTypes.TEXT, allowNull: true,
    });
    await queryInterface.sequelize.query(`
      UPDATE "ManualShipments"
      SET "paymentProofUrl" = "paymentProofUrls"->0->>'url'
      WHERE jsonb_array_length("paymentProofUrls") > 0
    `);
    await queryInterface.removeColumn('ManualShipments', 'paymentProofUrls');
  },
};
