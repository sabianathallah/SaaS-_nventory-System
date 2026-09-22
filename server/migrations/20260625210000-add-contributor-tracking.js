'use strict';

async function addColIfMissing(qi, table, column, def) {
  try {
    await qi.addColumn(table, column, def);
  } catch (e) {
    if (!e.message?.includes('already exists')) throw e;
  }
}

module.exports = {
  async up(queryInterface, Sequelize) {
    const FK = { type: Sequelize.INTEGER, allowNull: true, references: { model: 'Users', key: 'id' }, onDelete: 'SET NULL', onUpdate: 'CASCADE' };

    // Stock_In_Headers
    await addColIfMissing(queryInterface, 'Stock_In_Headers',      'createdBy',   FK);
    await addColIfMissing(queryInterface, 'Stock_In_Headers',      'updatedBy',   FK);

    // Stock_Out_Headers
    await addColIfMissing(queryInterface, 'Stock_Out_Headers',     'createdBy',   FK);
    await addColIfMissing(queryInterface, 'Stock_Out_Headers',     'updatedBy',   FK);

    // StockTransfers
    await addColIfMissing(queryInterface, 'StockTransfers',        'updatedBy',   FK);

    // Stock_Opname_Sessions
    await addColIfMissing(queryInterface, 'Stock_Opname_Sessions', 'createdBy',   FK);
    await addColIfMissing(queryInterface, 'Stock_Opname_Sessions', 'updatedBy',   FK);
    await addColIfMissing(queryInterface, 'Stock_Opname_Sessions', 'closedBy',    FK);

    // Handovers
    await addColIfMissing(queryInterface, 'Handovers',             'updatedBy',   FK);
    await addColIfMissing(queryInterface, 'Handovers',             'closedBy',    FK);

    // ManualShipments
    await addColIfMissing(queryInterface, 'ManualShipments',       'updatedBy',   FK);
    await addColIfMissing(queryInterface, 'ManualShipments',       'submittedBy', FK);

    // Requests
    await addColIfMissing(queryInterface, 'Requests',              'updatedBy',   FK);
  },

  async down(queryInterface) {
    const pairs = [
      ['Stock_In_Headers',      'createdBy'],
      ['Stock_In_Headers',      'updatedBy'],
      ['Stock_Out_Headers',     'createdBy'],
      ['Stock_Out_Headers',     'updatedBy'],
      ['StockTransfers',        'updatedBy'],
      ['Stock_Opname_Sessions', 'createdBy'],
      ['Stock_Opname_Sessions', 'updatedBy'],
      ['Stock_Opname_Sessions', 'closedBy'],
      ['Handovers',             'updatedBy'],
      ['Handovers',             'closedBy'],
      ['ManualShipments',       'updatedBy'],
      ['ManualShipments',       'submittedBy'],
      ['Requests',              'updatedBy'],
    ];
    for (const [table, col] of pairs) {
      try { await queryInterface.removeColumn(table, col); } catch {}
    }
  },
};
