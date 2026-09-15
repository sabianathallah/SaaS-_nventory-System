'use strict';
/**
 * Recalculates ProductSKU.qty and Stocks.quantity from authoritative sources:
 *   - IN  side: Stock_In_Items (always has ProductSKUId)
 *   - OUT side: Stock_Movements WHERE type='OUT' AND ProductSKUId IS NOT NULL
 *   - ADJ side: Stock_Movements WHERE type IN ('IN','OUT','ADJUSTMENT') via ProductId+WarehouseId for Stocks
 *
 * Does NOT delete any data — only UPDATEs qty fields.
 * Safe to run multiple times (idempotent).
 */
const { Client } = require('pg');

const DB_URL = process.env.DATABASE_URL || 'postgresql://postgres:dHbhMGXBjCteDLmkHOLBkGIkUhLjdOPA@shortline.proxy.rlwy.net:42786/railway';

async function run() {
  const client = new Client({ connectionString: DB_URL });
  await client.connect();
  console.log('Connected to Railway DB');

  try {
    await client.query('BEGIN');

    // ── 1. Sync ProductSKU.qty ────────────────────────────────────────────────
    // IN  = Stock_In_Items (source of truth for all historical stock ins)
    // OUT = Stock_Movements WHERE type='OUT' AND ProductSKUId IS NOT NULL
    const skuSync = await client.query(`
      WITH
        ins AS (
          SELECT "ProductSKUId", SUM(quantity) AS total_in
          FROM "Stock_In_Items"
          WHERE "ProductSKUId" IS NOT NULL
          GROUP BY "ProductSKUId"
        ),
        outs AS (
          SELECT "ProductSKUId", SUM(quantity) AS total_out
          FROM "Stock_Movements"
          WHERE type = 'OUT' AND "ProductSKUId" IS NOT NULL
          GROUP BY "ProductSKUId"
        )
      UPDATE "ProductSKUs" ps
      SET qty = calc.net
      FROM (
        SELECT
          COALESCE(i."ProductSKUId", o."ProductSKUId") AS sku_id,
          COALESCE(i.total_in, 0) - COALESCE(o.total_out, 0) AS net
        FROM (
          SELECT "ProductSKUId", SUM(quantity) AS total_in
          FROM "Stock_In_Items"
          WHERE "ProductSKUId" IS NOT NULL
          GROUP BY "ProductSKUId"
        ) i
        FULL OUTER JOIN (
          SELECT "ProductSKUId", SUM(quantity) AS total_out
          FROM "Stock_Movements"
          WHERE type = 'OUT' AND "ProductSKUId" IS NOT NULL
          GROUP BY "ProductSKUId"
        ) o ON i."ProductSKUId" = o."ProductSKUId"
      ) calc
      WHERE ps.id = calc.sku_id
      RETURNING ps.id, ps.sku_code, ps.qty
    `);
    console.log(`\nSynced ${skuSync.rowCount} ProductSKU rows:`);
    skuSync.rows.forEach(r => console.log(`  SKU #${r.id} (${r.sku_code}): qty = ${r.qty}`));

    // SKUs with no history at all → set to 0
    const skuZero = await client.query(`
      UPDATE "ProductSKUs"
      SET qty = 0
      WHERE id NOT IN (
        SELECT DISTINCT "ProductSKUId" FROM "Stock_In_Items" WHERE "ProductSKUId" IS NOT NULL
        UNION
        SELECT DISTINCT "ProductSKUId" FROM "Stock_Movements" WHERE "ProductSKUId" IS NOT NULL
      )
      AND qty != 0
      RETURNING id, sku_code, qty
    `);
    if (skuZero.rowCount > 0) {
      console.log(`\nReset ${skuZero.rowCount} SKUs with no history to qty=0`);
      skuZero.rows.forEach(r => console.log(`  SKU #${r.id} (${r.sku_code}): qty = 0`));
    }

    // ── 2. Sync Stocks.quantity (warehouse-level) ─────────────────────────────
    // Still use movements — ProductId+WarehouseId is always set in movements
    const stockSync = await client.query(`
      UPDATE "Stocks" s
      SET quantity = COALESCE(m.net, 0)
      FROM (
        SELECT
          "ProductId",
          "WarehouseId",
          SUM(CASE WHEN type = 'IN' THEN quantity ELSE -quantity END) AS net
        FROM "Stock_Movements"
        WHERE "ProductId" IS NOT NULL AND "WarehouseId" IS NOT NULL
        GROUP BY "ProductId", "WarehouseId"
      ) m
      WHERE s."ProductId" = m."ProductId" AND s."WarehouseId" = m."WarehouseId"
      RETURNING s.id, s."ProductId", s."WarehouseId", s.quantity
    `);
    console.log(`\nSynced ${stockSync.rowCount} Stocks rows:`);
    stockSync.rows.forEach(r =>
      console.log(`  Stock product=${r.ProductId} wh=${r.WarehouseId}: qty = ${r.quantity}`)
    );

    await client.query('COMMIT');
    console.log('\nDone — all committed, no historical data deleted.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error — rolled back:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
