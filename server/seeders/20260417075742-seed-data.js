'use strict';

const { hashPassword } = require('../helpers/bcrypt');
const fs = require('fs/promises');
const path = require('path');

const dataDir = path.join(__dirname, '..', 'data');

const loadJson = async (filename) => {
  const raw = await fs.readFile(path.join(dataDir, filename), 'utf8');
  return JSON.parse(raw);
};

const withTimestamps = (rows, now) => rows.map((row) => ({
  ...row,
  createdAt: now,
  updatedAt: now
}));

const normalizeDate = (value) => (value ? new Date(value) : null);

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    const now = new Date();
    const [
      categories,
      warehouses,
      suppliers,
      users,
      products,
      stocks,
      stockInHeaders,
      stockOutHeaders,
      stockOpnameSessions,
      stockOpnameItems,
      stockMovements
    ] = await Promise.all([
      loadJson('categories.json'),
      loadJson('warehouses.json'),
      loadJson('suppliers.json'),
      loadJson('users.json'),
      loadJson('products.json'),
      loadJson('stocks.json'),
      loadJson('stock_in_headers.json'),
      loadJson('stock_out_headers.json'),
      loadJson('stock_opname_sessions.json'),
      loadJson('stock_opname_items.json'),
      loadJson('stock_movements.json')
    ]);

    const usersToInsert = withTimestamps(users.map((user) => ({
      ...user,
      password: hashPassword(user.password)
    })), now);

    const stockInHeadersToInsert = withTimestamps(stockInHeaders.map((row) => ({
      ...row,
      date: normalizeDate(row.date)
    })), now);

    const stockOutHeadersToInsert = withTimestamps(stockOutHeaders.map((row) => ({
      ...row,
      date: normalizeDate(row.date)
    })), now);

    const stockOpnameSessionsToInsert = withTimestamps(stockOpnameSessions.map((row) => ({
      ...row,
      started_at: normalizeDate(row.started_at),
      finished_at: normalizeDate(row.finished_at)
    })), now);

    await queryInterface.bulkInsert('Categories', withTimestamps(categories, now), {});
    await queryInterface.bulkInsert('Warehouses', withTimestamps(warehouses, now), {});
    await queryInterface.bulkInsert('Suppliers', withTimestamps(suppliers, now), {});
    await queryInterface.bulkInsert('Users', usersToInsert, {});
    await queryInterface.bulkInsert('Products', withTimestamps(products, now), {});
    await queryInterface.bulkInsert('Stocks', withTimestamps(stocks, now), {});
    await queryInterface.bulkInsert('Stock_In_Headers', stockInHeadersToInsert, {});
    await queryInterface.bulkInsert('Stock_Out_Headers', stockOutHeadersToInsert, {});
    await queryInterface.bulkInsert('Stock_Opname_Sessions', stockOpnameSessionsToInsert, {});
    await queryInterface.bulkInsert('Stock_Opname_Items', withTimestamps(stockOpnameItems, now), {});
    await queryInterface.bulkInsert('Stock_Movements', withTimestamps(stockMovements, now), {});
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.bulkDelete('Stock_Movements', null, {});
    await queryInterface.bulkDelete('Stock_Opname_Items', null, {});
    await queryInterface.bulkDelete('Stock_Opname_Sessions', null, {});
    await queryInterface.bulkDelete('Stock_Out_Headers', null, {});
    await queryInterface.bulkDelete('Stock_In_Headers', null, {});
    await queryInterface.bulkDelete('Stocks', null, {});
    await queryInterface.bulkDelete('Products', null, {});
    await queryInterface.bulkDelete('Users', null, {});
    await queryInterface.bulkDelete('Suppliers', null, {});
    await queryInterface.bulkDelete('Warehouses', null, {});
    await queryInterface.bulkDelete('Categories', null, {});
  }
};
