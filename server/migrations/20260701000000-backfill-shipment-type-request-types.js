'use strict';

// Backfill shipmentType untuk RequestTypes lama yang dibuat sebelum kolom ini ada
// (lihat 20260629110000-add-shipment-type-to-request-types.js).
// HANYA update baris yang shipmentType-nya masih NULL — tidak menyentuh baris
// yang sudah pernah di-set manual lewat Catalog, dan tidak mengubah kolom lain.

const NAME_TO_TYPE = {
  'endorse':      'non_sales',
  'photoshoot':   'non_sales',
  'lainnya':      'non_sales',
  'early access': 'sales',
  'sales':        'sales',
};

module.exports = {
  async up(queryInterface, Sequelize) {
    for (const [name, shipmentType] of Object.entries(NAME_TO_TYPE)) {
      await queryInterface.sequelize.query(
        `UPDATE "RequestTypes" SET "shipmentType" = :shipmentType, "updatedAt" = NOW()
         WHERE LOWER(name) = :name AND "shipmentType" IS NULL`,
        { replacements: { shipmentType, name } }
      );
    }
  },

  async down(queryInterface) {
    // Revert hanya baris yang cocok nama — kembalikan ke NULL seperti semula
    const names = Object.keys(NAME_TO_TYPE);
    await queryInterface.sequelize.query(
      `UPDATE "RequestTypes" SET "shipmentType" = NULL WHERE LOWER(name) = ANY(:names)`,
      { replacements: { names } }
    );
  },
};
