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

      // ── 2. Total stock & value from ProductSKUs ───────────────────
      const [skuRow] = await sequelize.query(`
        SELECT
          COALESCE(SUM(ps.qty),              0)::bigint  AS total_stock,
          COALESCE(SUM(ps.price * ps.qty),   0)::numeric AS total_value
        FROM "ProductSKUs" ps
        JOIN "Products" p ON ps."ProductId" = p.id
        WHERE 1=1 ${clause}
      `, opts);

      // ── 3. Stock & value per article (from ProductSKUs) ───────────
      const stockByArticle = await sequelize.query(`
        SELECT
          a.id                                              AS "articleId",
          COALESCE(a.name, 'Tanpa Artikel')                AS "articleName",
          COALESCE(SUM(ps.qty),            0)::bigint      AS "totalStock",
          COALESCE(SUM(ps.price * ps.qty), 0)::numeric     AS "totalValue"
        FROM "ProductSKUs" ps
        JOIN "Products"  p ON ps."ProductId" = p.id
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

      // ── 6. Stock per warehouse × article (from Stock table) ───────
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
      });
    } catch (err) { next(err); }
  }
}

module.exports = DashboardController;
