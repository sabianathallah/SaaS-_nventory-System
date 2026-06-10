'use strict';
const { QueryTypes } = require('sequelize');
const { sequelize }  = require('../models');

function companyScope(req) {
  if (req.user.role === 'SUPER_ADMIN') {
    const id = req.query.companyId ? parseInt(req.query.companyId) : null;
    return { clause: id ? 'AND sm."companyId" = :cid' : '', params: id ? { cid: id } : {} };
  }
  return { clause: 'AND sm."companyId" = :cid', params: { cid: req.user.companyId } };
}

class ReportController {
  // GET /reports/monthly?year=2025&warehouseId=1
  static async monthly(req, res, next) {
    try {
      const { clause, params } = companyScope(req);
      const year        = parseInt(req.query.year) || new Date().getFullYear();
      const warehouseId = req.query.warehouseId ? parseInt(req.query.warehouseId) : null;

      const whClause = warehouseId ? 'AND sm."WarehouseId" = :whId' : '';
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
          ${clause} ${whClause}
        GROUP BY month, sm.type
        ORDER BY month
      `, { type: QueryTypes.SELECT, replacements });

      // Shape into 12-month array
      const months = Array.from({ length: 12 }, (_, i) => ({
        month: i + 1,
        inQty: 0, inValue: 0,
        outQty: 0, outValue: 0,
      }));

      for (const r of rows) {
        const m = months[r.month - 1];
        if (r.type === 'IN')  { m.inQty  = Number(r.total_qty); m.inValue  = Number(r.total_value); }
        if (r.type === 'OUT') { m.outQty = Number(r.total_qty); m.outValue = Number(r.total_value); }
      }

      res.json({ year, months });
    } catch (err) { next(err); }
  }
}

module.exports = ReportController;
