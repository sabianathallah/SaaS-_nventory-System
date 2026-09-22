'use strict';

// Beberapa ejaan bebas "Lainnya: ..." yang sebenarnya sama-sama berarti retur dari customer,
// dirapikan jadi satu purpose resmi "Retur Customer".
const VARIANTS = [
  'Lainnya: RETURN CUSTOMER',
  'Lainnya: RETURN CUST',
  'Lainnya: RETUR CUSTOMER',
  'Lainnya: Retur Customer',
];

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(
      `UPDATE "Stock_Out_Headers" SET purpose = 'Retur Customer' WHERE purpose IN (:variants)`,
      { replacements: { variants: VARIANTS } }
    );
  },

  async down(queryInterface) {
    // Tidak reversibel 1:1 (ejaan asli hilang) — sengaja no-op.
  },
};
