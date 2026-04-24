'use strict';

/**
 * Relax required fields so FE forms (which don't always collect every column)
 * can create rows without hitting NOT NULL constraints. Also add header-level
 * WarehouseId to StockIn/StockOut headers so the list view can show warehouse.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Products: barcode / qrString optional (FE marks them as optional hints)
    await queryInterface.changeColumn('Products', 'barcode', {
      type: Sequelize.STRING, allowNull: true,
    });
    await queryInterface.changeColumn('Products', 'qrString', {
      type: Sequelize.STRING, allowNull: true,
    });

    // Stock In header: supplier optional, date optional (controller defaults to NOW),
    // add WarehouseId so FE's single-warehouse UI maps cleanly.
    await queryInterface.changeColumn('Stock_In_Headers', 'SupplierId', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: 'Suppliers', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
    await queryInterface.changeColumn('Stock_In_Headers', 'date', {
      type: Sequelize.DATE, allowNull: true,
    });
    const inCols = await queryInterface.describeTable('Stock_In_Headers');
    if (!inCols.WarehouseId) {
      await queryInterface.addColumn('Stock_In_Headers', 'WarehouseId', {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'Warehouses', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      });
    }

    // Stock Out header: destination optional, date optional, add WarehouseId
    await queryInterface.changeColumn('Stock_Out_Headers', 'destination', {
      type: Sequelize.STRING, allowNull: true,
    });
    await queryInterface.changeColumn('Stock_Out_Headers', 'date', {
      type: Sequelize.DATE, allowNull: true,
    });
    const outCols = await queryInterface.describeTable('Stock_Out_Headers');
    if (!outCols.WarehouseId) {
      await queryInterface.addColumn('Stock_Out_Headers', 'WarehouseId', {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'Warehouses', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      });
    }

    // Stock Opname Session: started_at + status optional at DB level (model still
    // provides defaults). FE only sends warehouseId + note.
    await queryInterface.changeColumn('Stock_Opname_Sessions', 'started_at', {
      type: Sequelize.DATE, allowNull: true,
    });
    await queryInterface.changeColumn('Stock_Opname_Sessions', 'status', {
      type: Sequelize.STRING, allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.changeColumn('Products', 'barcode',  { type: Sequelize.STRING, allowNull: false });
    await queryInterface.changeColumn('Products', 'qrString', { type: Sequelize.STRING, allowNull: false });

    await queryInterface.changeColumn('Stock_In_Headers', 'SupplierId', {
      type: Sequelize.INTEGER, allowNull: false,
      references: { model: 'Suppliers', key: 'id' },
      onUpdate: 'CASCADE', onDelete: 'CASCADE',
    });
    await queryInterface.changeColumn('Stock_In_Headers', 'date', { type: Sequelize.DATE, allowNull: false });
    await queryInterface.removeColumn('Stock_In_Headers', 'WarehouseId').catch(() => {});

    await queryInterface.changeColumn('Stock_Out_Headers', 'destination', { type: Sequelize.STRING, allowNull: false });
    await queryInterface.changeColumn('Stock_Out_Headers', 'date',        { type: Sequelize.DATE,   allowNull: false });
    await queryInterface.removeColumn('Stock_Out_Headers', 'WarehouseId').catch(() => {});

    await queryInterface.changeColumn('Stock_Opname_Sessions', 'started_at', { type: Sequelize.DATE,   allowNull: false });
    await queryInterface.changeColumn('Stock_Opname_Sessions', 'status',     { type: Sequelize.STRING, allowNull: false });
  },
};
