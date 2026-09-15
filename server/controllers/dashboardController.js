'use strict';
const { QueryTypes } = require('sequelize');
const { sequelize }  = require('../models');

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

      const whId     = req.query.warehouseId ? parseInt(req.query.warehouseId) : null;
      const whClause = whId ? 'AND sws."WarehouseId" = :whId' : '';
      const allParams = whId ? { ...params, whId } : params;
      const opts = { type: QueryTypes.SELECT, replacements: allParams };

      // ── 1. Total products ─────────────────────────────────────────
      const [prodRow] = await sequelize.query(`
        SELECT COUNT(*)::int AS val
        FROM "Products" p
        WHERE 1=1 ${clause}
      `, opts);

      // ── 2. Total stock & value from SkuWarehouseStocks ───────────
      // Value = per-SKU qty × SKU price (exact, not averaged)
      const [skuRow] = await sequelize.query(`
        SELECT
          COALESCE(SUM(sws.qty), 0)::bigint            AS total_stock,
          COALESCE(SUM(sws.qty::numeric * ps.price), 0)::numeric AS total_value
        FROM "SkuWarehouseStocks" sws
        JOIN "ProductSKUs" ps ON ps.id = sws."ProductSKUId"
        JOIN "Products"    p  ON p.id  = ps."ProductId"
        WHERE 1=1 ${clause} ${whClause}
      `, opts);

      // ── 3. Stock & value per article ─────────────────────────────
      const stockByArticle = await sequelize.query(`
        SELECT
          a.id                                                      AS "articleId",
          COALESCE(a.name, 'Tanpa Artikel')                        AS "articleName",
          COALESCE(SUM(sws.qty), 0)::bigint                        AS "totalStock",
          COALESCE(SUM(sws.qty::numeric * ps.price), 0)::numeric   AS "totalValue"
        FROM "SkuWarehouseStocks" sws
        JOIN "ProductSKUs" ps ON ps.id = sws."ProductSKUId"
        JOIN "Products"    p  ON p.id  = ps."ProductId"
        LEFT JOIN "Articles" a ON a.id = p."ArticleId"
        WHERE 1=1 ${clause} ${whClause}
        GROUP BY a.id, a.name
        ORDER BY "totalValue" DESC NULLS LAST
      `, opts);

      // ── 4. Stock per warehouse ────────────────────────────────────
      const stockByWarehouse = await sequelize.query(`
        SELECT
          w.id                                   AS "warehouseId",
          w.name                                 AS "warehouseName",
          COALESCE(SUM(sws.qty), 0)::bigint      AS "totalStock"
        FROM "SkuWarehouseStocks" sws
        JOIN "ProductSKUs" ps ON ps.id = sws."ProductSKUId"
        JOIN "Products"    p  ON p.id  = ps."ProductId"
        JOIN "Warehouses"  w  ON w.id  = sws."WarehouseId"
        WHERE 1=1 ${clause} ${whClause}
        GROUP BY w.id, w.name
        ORDER BY "totalStock" DESC
      `, opts);

      // ── 5. Today's movement count ─────────────────────────────────
      const [todayRow] = await sequelize.query(`
        SELECT COUNT(*)::int AS val
        FROM "Stock_Movements" sm
        JOIN "Products" p ON sm."ProductId" = p.id
        WHERE DATE(sm."date" AT TIME ZONE 'Asia/Jakarta') = CURRENT_DATE
          ${clause}
      `, opts);

      // ── 6. Low stock items (total qty ≤ 5) ───────────────────────
      // Use ProductSKU.qty (denormalized total) for efficiency
      const lowStockOpts = { type: QueryTypes.SELECT, replacements: params };
      const lowStockItems = await sequelize.query(`
        SELECT
          p.id                                        AS "productId",
          p.name                                      AS "productName",
          p.sku                                       AS "productSku",
          COALESCE(SUM(ps.qty), 0)::int               AS "totalStock"
        FROM "Products" p
        LEFT JOIN "ProductSKUs" ps ON ps."ProductId" = p.id
        WHERE 1=1 ${clause}
        GROUP BY p.id, p.name, p.sku
        HAVING COALESCE(SUM(ps.qty), 0) <= 5
        ORDER BY "totalStock" ASC, p.name ASC
        LIMIT 10
      `, lowStockOpts);

      // ── 7. Stock per warehouse × article ──────────────────────────
      const stockByWarehouseAndArticle = await sequelize.query(`
        SELECT
          w.id                                         AS "warehouseId",
          w.name                                       AS "warehouseName",
          a.id                                         AS "articleId",
          COALESCE(a.name, 'Tanpa Artikel')            AS "articleName",
          COALESCE(SUM(sws.qty), 0)::bigint            AS "totalStock"
        FROM "SkuWarehouseStocks" sws
        JOIN "ProductSKUs" ps ON ps.id = sws."ProductSKUId"
        JOIN "Products"    p  ON p.id  = ps."ProductId"
        JOIN "Warehouses"  w  ON w.id  = sws."WarehouseId"
        LEFT JOIN "Articles" a ON a.id = p."ArticleId"
        WHERE 1=1 ${clause} ${whClause}
        GROUP BY w.id, w.name, a.id, a.name
        ORDER BY w.name, "totalStock" DESC NULLS LAST
      `, opts);

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
