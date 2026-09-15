'use strict';

module.exports = {
  async up(queryInterface) {
    // Endorse: barang diberikan ke influencer → tidak perlu kembali
    await queryInterface.sequelize.query(`
      UPDATE "Requests" r
      SET "needsReturn" = false, "updatedAt" = NOW()
      FROM "RequestTypes" rt
      WHERE r."requestTypeId" = rt.id
        AND LOWER(rt.name) = 'endorse'
        AND r."needsReturn" = true
    `);
    // Photoshoot: barang dipinjam untuk foto → perlu kembali
    await queryInterface.sequelize.query(`
      UPDATE "Requests" r
      SET "needsReturn" = true, "updatedAt" = NOW()
      FROM "RequestTypes" rt
      WHERE r."requestTypeId" = rt.id
        AND LOWER(rt.name) = 'photoshoot'
        AND r."needsReturn" = false
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      UPDATE "Requests" r SET "needsReturn" = true, "updatedAt" = NOW()
      FROM "RequestTypes" rt WHERE r."requestTypeId" = rt.id AND LOWER(rt.name) = 'endorse'
    `);
    await queryInterface.sequelize.query(`
      UPDATE "Requests" r SET "needsReturn" = false, "updatedAt" = NOW()
      FROM "RequestTypes" rt WHERE r."requestTypeId" = rt.id AND LOWER(rt.name) = 'photoshoot'
    `);
  },
};
