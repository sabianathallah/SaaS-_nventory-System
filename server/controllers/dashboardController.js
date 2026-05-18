'use strict';
const { QueryTypes } = require('sequelize');
const { sequelize }  = require('../models');

// Build a safe parameterized WHERE clause for company scoping
function companyScope(req) {
  if (req.user.role === 'SUPER_ADMIN') {
    const id = req.query.companyId ? parseInt(req.query.companyId) : null;
    return {
      clause: id ? 'AND p."companyId" = :cid' : '',
      params: id ? { cid: id } : {},
    };
  }
  return {
    clause: 'AND p."companyId" = :cid',
    params: { cid: req.user.companyId },
  };
}

class DashboardController {
  static async getStats(req, res, next) {
    try {
      const { clause, params } = companyScope(req);
      const opts = { type: QueryTypes.SELECT, replacements: params };

      // ── 1. Total products ─────────────────────────────────────────
      const [prodRow] = await sequelize.query(`
        SELECT COUNT(*)::int AS val
        FROM "Products" p
        WHERE 1=1 ${clause}
      `, opts);

      // ── 2. Total stock & value from Stocks table ─────────────────
      // Value = warehouse_quantity × avg SKU price per product
      // This is the same formula used in per-warehouse views so all numbers are consistent.
      const [skuRow] = await sequelize.query(`
        SELECT
          COALESCE(SUM(s.quantity), 0)::bigint AS total_stock,
          COALESCE(SUM(
            s.quantity::numeric * (
              SELECT COALESCE(AVG(ps2.price), 0)
              FROM "ProductSKUs" ps2 WHERE ps2."ProductId" = s."ProductId"
            )
          ), 0)::numeric AS total_value
        FROM "Stocks" s
        JOIN "Products" p ON s."ProductId" = p.id
        WHERE 1=1 ${clause}
      `, opts);

      // ── 3. Stock & value per article (from Stocks table) ─────────
      const stockByArticle = await sequelize.query(`
        SELECT
          a.id                                              AS "articleId",
          COALESCE(a.name, 'Tanpa Artikel')                AS "articleName",
          COALESCE(SUM(s.quantity), 0)::bigint             AS "totalStock",
          COALESCE(SUM(
            s.quantity::numeric * (
              SELECT COALESCE(AVG(ps2.price), 0)
              FROM "ProductSKUs" ps2 WHERE ps2."ProductId" = s."ProductId"
            )
          ), 0)::numeric AS "totalValue"
        FROM "Stocks" s
        JOIN "Products"  p ON s."ProductId" = p.id
        LEFT JOIN "Articles" a ON p."ArticleId" = a.id
        WHERE 1=1 ${clause}
        GROUP BY a.id, a.name
        ORDER BY "totalValue" DESC NULLS LAST
      `, opts);

      // ── 4. Stock per warehouse (from Stock table) ─────────────────
      const stockByWarehouse = await sequelize.query(`
        SELECT
          w.id                                        AS "warehouseId",
          w.name                                      AS "warehouseName",
          COALESCE(SUM(s.quantity), 0)::bigint        AS "totalStock"
        FROM "Stocks" s
        JOIN "Warehouses" w ON s."WarehouseId" = w.id
        JOIN "Products"   p ON s."ProductId"   = p.id
        WHERE 1=1 ${clause}
        GROUP BY w.id, w.name
        ORDER BY "totalStock" DESC
      `, opts);

      // ── 5. Today's movement count ─────────────────────────────────
      const todayClause = clause.replace(/p\."companyId"/g, 'p."companyId"');
      const [todayRow] = await sequelize.query(`
        SELECT COUNT(*)::int AS val
        FROM "Stock_Movements" sm
        JOIN "Products" p ON sm."ProductId" = p.id
        WHERE DATE(sm."createdAt" AT TIME ZONE 'Asia/Jakarta') = CURRENT_DATE ${todayClause}
      `, opts);

      // ── 6. Low stock items (total stock ≤ 5 across all warehouses) ──
      const lowStockItems = await sequelize.query(`
        SELECT
          p.id                                           AS "productId",
          p.name                                         AS "productName",
          p.sku                                          AS "productSku",
          COALESCE(SUM(s.quantity), 0)::int              AS "totalStock"
        FROM "Products" p
        LEFT JOIN "Stocks" s ON s."ProductId" = p.id
        WHERE 1=1 ${clause}
        GROUP BY p.id, p.name, p.sku
        HAVING COALESCE(SUM(s.quantity), 0) <= 5
        ORDER BY "totalStock" ASC, p.name ASC
        LIMIT 10
      `, opts);

      // ── 7. Stock per warehouse × article (from Stock table) ───────
      const stockByWarehouseAndArticle = await sequelize.query(`
        SELECT
          w.id                                         AS "warehouseId",
          w.name                                       AS "warehouseName",
          a.id                                         AS "articleId",
          COALESCE(a.name, 'Tanpa Artikel')            AS "articleName",
          COALESCE(SUM(s.quantity), 0)::bigint         AS "totalStock"
        FROM "Stocks" s
        JOIN "Warehouses" w ON s."WarehouseId" = w.id
        JOIN "Products"   p ON s."ProductId"   = p.id
        LEFT JOIN "Articles" a ON p."ArticleId" = a.id
        WHERE 1=1 ${clause}
        GROUP BY w.id, w.name, a.id, a.name
        ORDER BY w.name, "totalStock" DESC NULLS LAST
      `, opts);

      // ── Serialize bigint / numeric to number ──────────────────────
      const n = (v) => Number(v ?? 0);

      res.json({
        totalProducts: prodRow.val,
        totalStock:    n(skuRow.total_stock),
        totalValue:    n(skuRow.total_value),

        stockByArticle: stockByArticle.map(r => ({
          articleId:   r.articleId,
          articleName: r.articleName,
          totalStock:  n(r.totalStock),
          totalValue:  n(r.totalValue),
        })),

        stockByWarehouse: stockByWarehouse.map(r => ({
          warehouseId:   r.warehouseId,
          warehouseName: r.warehouseName,
          totalStock:    n(r.totalStock),
        })),

        stockByWarehouseAndArticle: stockByWarehouseAndArticle.map(r => ({
          warehouseId:   r.warehouseId,
          warehouseName: r.warehouseName,
          articleId:     r.articleId,
          articleName:   r.articleName,
          totalStock:    n(r.totalStock),
        })),

        todayMovements: todayRow.val ?? 0,

        lowStockItems: lowStockItems.map(r => ({
          productId:   r.productId,
          productName: r.productName,
          productSku:  r.productSku,
          totalStock:  n(r.totalStock),
        })),
      });
    } catch (err) { next(err); }
  }
}

module.exports = DashboardController;
