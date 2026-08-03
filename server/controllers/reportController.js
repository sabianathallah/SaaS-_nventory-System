'use strict';
const { QueryTypes } = require('sequelize');
const { sequelize }  = require('../models');

// scope against Stock_Movements table
function smScope(req) {
  if (req.user.role === 'SUPER_ADMIN') {
    const id = req.query.companyId ? parseInt(req.query.companyId) : null;
    return { clause: id ? 'AND sm."companyId" = :cid' : '', params: id ? { cid: id } : {} };
  }
  return { clause: 'AND sm."companyId" = :cid', params: { cid: req.user.companyId } };
}

// scope against Products table
function pScope(req) {
  if (req.user.role === 'SUPER_ADMIN') {
    const id = req.query.companyId ? parseInt(req.query.companyId) : null;
    return { clause: id ? 'AND p."companyId" = :cid' : '', params: id ? { cid: id } : {} };
  }
  return { clause: 'AND p."companyId" = :cid', params: { cid: req.user.companyId } };
}

async function openingBalance(cutoffISO, clause, whClause, hideInitial, replacements) {
  const initClause = hideInitial ? `AND sm.source != 'INITIAL'` : '';
  const [row] = await sequelize.query(`
    SELECT COALESCE(SUM(
      CASE WHEN sm.type = 'IN' THEN sm.quantity ELSE -sm.quantity END
    ), 0)::bigint AS opening
    FROM "Stock_Movements" sm
    WHERE sm.date AT TIME ZONE 'Asia/Jakarta' < :cutoff
      ${clause} ${whClause} ${initClause}
  `, { type: QueryTypes.SELECT, replacements: { ...replacements, cutoff: cutoffISO } });
  return Number(row.opening ?? 0);
}

class ReportController {

  // GET /reports/monthly?year=2026&warehouseId=1&hideInitial=true
  static async monthly(req, res, next) {
    try {
      const { clause, params } = smScope(req);
      const year        = parseInt(req.query.year) || new Date().getFullYear();
      const warehouseId = req.query.warehouseId ? parseInt(req.query.warehouseId) : null;
      const hideInitial = req.query.hideInitial === 'true';

      const whClause     = warehouseId ? 'AND sm."WarehouseId" = :whId' : '';
      const initClause   = hideInitial ? `AND sm.source != 'INITIAL'` : '';
      const replacements = { ...params, year, ...(warehouseId ? { whId: warehouseId } : {}) };

      const rows = await sequelize.query(`
        SELECT
          EXTRACT(MONTH FROM sm.date AT TIME ZONE 'Asia/Jakarta')::int AS month,
          sm.type,
          COALESCE(SUM(sm.quantity), 0)::bigint                        AS total_qty,
          COALESCE(SUM(sm.quantity::numeric * COALESCE(ps.price, 0)), 0)::numeric AS total_value
        FROM "Stock_Movements" sm
        LEFT JOIN "ProductSKUs" ps ON sm."ProductSKUId" = ps.id
        WHERE EXTRACT(YEAR FROM sm.date AT TIME ZONE 'Asia/Jakarta') = :year
          ${clause} ${whClause} ${initClause}
        GROUP BY month, sm.type
        ORDER BY month
      `, { type: QueryTypes.SELECT, replacements });

      const months = Array.from({ length: 12 }, (_, i) => ({
        month: i + 1, inQty: 0, inValue: 0, outQty: 0, outValue: 0, endingStock: 0,
      }));

      for (const r of rows) {
        const m = months[r.month - 1];
        if (r.type === 'IN')  { m.inQty  = Number(r.total_qty); m.inValue  = Number(r.total_value); }
        if (r.type === 'OUT') { m.outQty = Number(r.total_qty); m.outValue = Number(r.total_value); }
      }

      const startOfYear = `${year}-01-01T00:00:00`;
      let running = await openingBalance(startOfYear, clause, whClause, hideInitial, replacements);
      for (const m of months) {
        running += m.inQty - m.outQty;
        m.endingStock = running;
      }

      res.json({ year, months });
    } catch (err) { next(err); }
  }

  // GET /reports/daily?year=2026&month=6&warehouseId=1&hideInitial=true
  static async daily(req, res, next) {
    try {
      const { clause, params } = smScope(req);
      const now         = new Date();
      const year        = parseInt(req.query.year)  || now.getFullYear();
      const month       = parseInt(req.query.month) || (now.getMonth() + 1);
      const warehouseId = req.query.warehouseId ? parseInt(req.query.warehouseId) : null;
      const hideInitial = req.query.hideInitial === 'true';

      const whClause     = warehouseId ? 'AND sm."WarehouseId" = :whId' : '';
      const initClause   = hideInitial ? `AND sm.source != 'INITIAL'` : '';
      const replacements = { ...params, year, month, ...(warehouseId ? { whId: warehouseId } : {}) };

      const rows = await sequelize.query(`
        SELECT
          EXTRACT(DAY FROM sm.date AT TIME ZONE 'Asia/Jakarta')::int AS day,
          sm.type,
          COALESCE(SUM(sm.quantity), 0)::bigint                       AS total_qty,
          COALESCE(SUM(sm.quantity::numeric * COALESCE(ps.price, 0)), 0)::numeric AS total_value
        FROM "Stock_Movements" sm
        LEFT JOIN "ProductSKUs" ps ON sm."ProductSKUId" = ps.id
        WHERE EXTRACT(YEAR  FROM sm.date AT TIME ZONE 'Asia/Jakarta') = :year
          AND EXTRACT(MONTH FROM sm.date AT TIME ZONE 'Asia/Jakarta') = :month
          ${clause} ${whClause} ${initClause}
        GROUP BY day, sm.type
        ORDER BY day
      `, { type: QueryTypes.SELECT, replacements });

      const daysInMonth = new Date(year, month, 0).getDate();
      const days = Array.from({ length: daysInMonth }, (_, i) => ({
        day: i + 1, inQty: 0, inValue: 0, outQty: 0, outValue: 0, endingStock: 0,
      }));

      for (const r of rows) {
        const d = days[r.day - 1];
        if (r.type === 'IN')  { d.inQty  = Number(r.total_qty); d.inValue  = Number(r.total_value); }
        if (r.type === 'OUT') { d.outQty = Number(r.total_qty); d.outValue = Number(r.total_value); }
      }

      const startOfMonth = `${year}-${String(month).padStart(2, '0')}-01T00:00:00`;
      let running = await openingBalance(startOfMonth, clause, whClause, hideInitial, replacements);
      for (const d of days) {
        running += d.inQty - d.outQty;
        d.endingStock = running;
      }

      res.json({ year, month, days });
    } catch (err) { next(err); }
  }

  // GET /reports/daily-activity?date=2026-06-24&warehouseId=1
  // Activity log for a specific date: stock-in docs, stock-out docs, opname sessions, transfers
  static async dailyActivity(req, res, next) {
    try {
      const { clause, params } = smScope(req);
      const date        = req.query.date || new Date().toISOString().slice(0, 10);
      const warehouseId = req.query.warehouseId ? parseInt(req.query.warehouseId) : null;

      const whClause     = warehouseId ? 'AND sm."WarehouseId" = :whId' : '';
      const replacements = { ...params, date, ...(warehouseId ? { whId: warehouseId } : {}) };
      const opts         = { type: QueryTypes.SELECT, replacements };

      // Stock In docs
      const stockIn = await sequelize.query(`
        SELECT
          sm."ReferenceId"::int                                     AS id,
          MIN(sm.date)                                              AS date,
          COUNT(DISTINCT sm."ProductSKUId")::int                   AS "skuCount",
          COALESCE(SUM(sm.quantity), 0)::int                       AS "totalQty",
          COALESCE(SUM(sm.quantity::numeric * COALESCE(ps.price,0)),0)::numeric AS "totalValue",
          MIN(sih.note)                                            AS note,
          MIN(w.name)                                              AS "warehouseName",
          MIN(u.name)                                              AS "createdBy"
        FROM "Stock_Movements" sm
        LEFT JOIN "ProductSKUs" ps ON ps.id = sm."ProductSKUId"
        LEFT JOIN "Stock_In_Headers" sih ON sih.id = sm."ReferenceId"::int
        LEFT JOIN "Warehouses" w ON w.id = sm."WarehouseId"
        LEFT JOIN "Users" u ON u.id = sih."createdBy"
        WHERE sm.source = 'STOCK_IN'
          AND DATE(sm.date AT TIME ZONE 'Asia/Jakarta') = :date
          ${clause} ${whClause}
        GROUP BY sm."ReferenceId"
        ORDER BY date ASC
      `, opts);

      // Stock Out docs
      const stockOut = await sequelize.query(`
        SELECT
          sm."ReferenceId"::int                                     AS id,
          MIN(sm.date)                                              AS date,
          COUNT(DISTINCT sm."ProductSKUId")::int                   AS "skuCount",
          COALESCE(SUM(sm.quantity), 0)::int                       AS "totalQty",
          COALESCE(SUM(sm.quantity::numeric * COALESCE(ps.price,0)),0)::numeric AS "totalValue",
          MIN(soh.notes)                                           AS note,
          MIN(soh.purpose)                                         AS purpose,
          MIN(w.name)                                              AS "warehouseName",
          MIN(u.name)                                              AS "createdBy"
        FROM "Stock_Movements" sm
        LEFT JOIN "ProductSKUs" ps ON ps.id = sm."ProductSKUId"
        LEFT JOIN "Stock_Out_Headers" soh ON soh.id = sm."ReferenceId"::int
        LEFT JOIN "Warehouses" w ON w.id = sm."WarehouseId"
        LEFT JOIN "Users" u ON u.id = soh."createdBy"
        WHERE sm.source = 'STOCK_OUT'
          AND DATE(sm.date AT TIME ZONE 'Asia/Jakarta') = :date
          ${clause} ${whClause}
        GROUP BY sm."ReferenceId"
        ORDER BY date ASC
      `, opts);

      // Opname sessions
      const opname = await sequelize.query(`
        SELECT
          sm."ReferenceId"::int                                     AS id,
          MIN(sm.date)                                              AS date,
          COUNT(DISTINCT sm."ProductSKUId")::int                   AS "skuCount",
          COALESCE(SUM(CASE WHEN sm.quantity > 0 THEN sm.quantity ELSE 0 END),0)::int AS "addQty",
          COALESCE(SUM(CASE WHEN sm.quantity < 0 THEN ABS(sm.quantity) ELSE 0 END),0)::int AS "subQty",
          MIN(w.name)                                              AS "warehouseName",
          MIN(u.name)                                              AS "createdBy"
        FROM "Stock_Movements" sm
        LEFT JOIN "Stock_Opname_Sessions" sos ON sos.id = sm."ReferenceId"::int
        LEFT JOIN "Warehouses" w ON w.id = sm."WarehouseId"
        LEFT JOIN "Users" u ON u.id = sos."createdBy"
        WHERE sm.source = 'OPNAME'
          AND DATE(sm.date AT TIME ZONE 'Asia/Jakarta') = :date
          ${clause} ${whClause}
        GROUP BY sm."ReferenceId"
        ORDER BY date ASC
      `, opts);

      // Transfers
      const transfers = await sequelize.query(`
        SELECT
          sm."ReferenceId"::int                                     AS id,
          MIN(sm.date)                                              AS date,
          COUNT(DISTINCT sm."ProductSKUId")::int                   AS "skuCount",
          COALESCE(SUM(CASE WHEN sm.type='OUT' THEN sm.quantity ELSE 0 END),0)::int AS "totalQty",
          MIN(w_from.name)                                         AS "fromWarehouse",
          MIN(w_to.name)                                           AS "toWarehouse"
        FROM "Stock_Movements" sm
        LEFT JOIN "Stock_Transfers" st ON st.id = sm."ReferenceId"::int
        LEFT JOIN "Warehouses" w_from ON w_from.id = st."fromWarehouseId"
        LEFT JOIN "Warehouses" w_to   ON w_to.id   = st."toWarehouseId"
        WHERE sm.source = 'TRANSFER'
          AND DATE(sm.date AT TIME ZONE 'Asia/Jakarta') = :date
          ${clause}
        GROUP BY sm."ReferenceId"
        ORDER BY date ASC
      `, opts);

      const n = (v) => Number(v ?? 0);
      res.json({
        date,
        stockIn:   stockIn.map(r => ({ id: r.id, date: r.date, skuCount: n(r.skuCount), totalQty: n(r.totalQty), totalValue: n(r.totalValue), note: r.note, warehouseName: r.warehouseName, createdBy: r.createdBy })),
        stockOut:  stockOut.map(r => ({ id: r.id, date: r.date, skuCount: n(r.skuCount), totalQty: n(r.totalQty), totalValue: n(r.totalValue), note: r.note, purpose: r.purpose, warehouseName: r.warehouseName, createdBy: r.createdBy })),
        opname:    opname.map(r => ({ id: r.id, date: r.date, skuCount: n(r.skuCount), addQty: n(r.addQty), subQty: n(r.subQty), warehouseName: r.warehouseName, createdBy: r.createdBy })),
        transfers: transfers.map(r => ({ id: r.id, date: r.date, skuCount: n(r.skuCount), totalQty: n(r.totalQty), fromWarehouse: r.fromWarehouse, toWarehouse: r.toWarehouse })),
      });
    } catch (err) { next(err); }
  }

  // GET /reports/yearly?warehouseId=1&hideInitial=true
  static async yearly(req, res, next) {
    try {
      const { clause, params } = smScope(req);
      const warehouseId = req.query.warehouseId ? parseInt(req.query.warehouseId) : null;
      const hideInitial = req.query.hideInitial === 'true';
      const currentYear = new Date().getFullYear();

      const whClause     = warehouseId ? 'AND sm."WarehouseId" = :whId' : '';
      const initClause   = hideInitial ? `AND sm.source != 'INITIAL'` : '';
      const replacements = { ...params, ...(warehouseId ? { whId: warehouseId } : {}) };

      const rows = await sequelize.query(`
        SELECT
          EXTRACT(YEAR FROM sm.date AT TIME ZONE 'Asia/Jakarta')::int AS year,
          sm.type,
          COALESCE(SUM(sm.quantity), 0)::bigint                        AS total_qty,
          COALESCE(SUM(sm.quantity::numeric * COALESCE(ps.price, 0)), 0)::numeric AS total_value
        FROM "Stock_Movements" sm
        LEFT JOIN "ProductSKUs" ps ON sm."ProductSKUId" = ps.id
        WHERE 1=1 ${clause} ${whClause} ${initClause}
        GROUP BY year, sm.type
        ORDER BY year
      `, { type: QueryTypes.SELECT, replacements });

      const map = {};
      for (const r of rows) {
        if (!map[r.year]) map[r.year] = { year: r.year, inQty: 0, inValue: 0, outQty: 0, outValue: 0 };
        if (r.type === 'IN')  { map[r.year].inQty  = Number(r.total_qty); map[r.year].inValue  = Number(r.total_value); }
        if (r.type === 'OUT') { map[r.year].outQty = Number(r.total_qty); map[r.year].outValue = Number(r.total_value); }
      }

      const allYears  = Object.keys(map).map(Number);
      const minYear   = allYears.length ? Math.min(...allYears) : currentYear;
      const years     = [];
      let running     = 0;
      for (let y = minYear; y <= currentYear; y++) {
        const entry = map[y] ?? { year: y, inQty: 0, inValue: 0, outQty: 0, outValue: 0 };
        running += entry.inQty - entry.outQty;
        years.push({ ...entry, endingStock: running });
      }

      res.json({ years });
    } catch (err) { next(err); }
  }

  // GET /reports/snapshot?warehouseId=1
  static async snapshot(req, res, next) {
    try {
      const { clause, params } = pScope(req);
      const warehouseId = req.query.warehouseId ? parseInt(req.query.warehouseId) : null;

      const whJoin = warehouseId
        ? `LEFT JOIN "SkuWarehouseStocks" sws ON sws."ProductSKUId" = ps.id AND sws."WarehouseId" = :whId`
        : `LEFT JOIN "SkuWarehouseStocks" sws ON sws."ProductSKUId" = ps.id`;

      const replacements = { ...params, ...(warehouseId ? { whId: warehouseId } : {}) };

      const rows = await sequelize.query(`
        SELECT
          p.id                                                    AS "productId",
          p.name                                                  AS "productName",
          p.sku                                                   AS "productSku",
          COALESCE(a.name, 'Tanpa Artikel')                      AS "articleName",
          COALESCE(SUM(sws.qty), 0)::int                         AS "totalQty",
          COALESCE(SUM(sws.qty::numeric * ps.price), 0)::numeric AS "totalValue"
        FROM "Products" p
        LEFT JOIN "Articles" a ON a.id = p."ArticleId"
        LEFT JOIN "ProductSKUs" ps ON ps."ProductId" = p.id
        ${whJoin}
        WHERE 1=1 ${clause}
        GROUP BY p.id, p.name, p.sku, a.name
        ORDER BY "totalQty" DESC, p.name ASC
      `, { type: QueryTypes.SELECT, replacements });

      const n = (v) => Number(v ?? 0);
      res.json({
        items: rows.map(r => ({
          productId:   r.productId,
          productName: r.productName,
          productSku:  r.productSku,
          articleName: r.articleName,
          totalQty:    n(r.totalQty),
          totalValue:  n(r.totalValue),
        })),
      });
    } catch (err) { next(err); }
  }
}

module.exports = ReportController;
