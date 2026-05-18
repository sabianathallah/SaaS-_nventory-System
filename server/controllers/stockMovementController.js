'use strict';
const { Stock_Movement, Product, ProductSKU, ProductVariantOption, Warehouse, sequelize } = require('../models');
const { Op, fn, col, literal } = require('sequelize');
const { companyFilter, companyId } = require('../helpers/tenancy');
const { paginate, buildFilter, paginatedResponse } = require('../helpers/queryHelper');

class StockMovementController {
    static async getAll(req, res, next) {
        try {
            const { page, limit, offset } = paginate(req.query);
            const filter = buildFilter(req.query, {
                type:        'exact',
                ProductId:   'exact',
                WarehouseId: 'exact',
                dateFrom:    { field: 'createdAt', type: 'gte' },
                dateTo:      { field: 'createdAt', type: 'lte' },
            });
            const { rows, count } = await Stock_Movement.findAndCountAll({
                where: { ...companyFilter(req), ...filter },
                include: [
                    { model: Product,   attributes: ['id', 'name', 'sku', 'unit'] },
                    { model: Warehouse, attributes: ['id', 'name'] },
                    {
                        model: ProductSKU, attributes: ['id', 'sku_code'], required: false,
                        include: [{ model: ProductVariantOption, attributes: ['id', 'value'], through: { attributes: [] } }]
                    },
                ],
                order: [['createdAt', 'DESC']],
                limit, offset,
                distinct: true
            });
            res.status(200).json(paginatedResponse(rows, count, page, limit));
        } catch (err) { next(err); }
    }

    static async getById(req, res, next) {
        try {
            const movement = await Stock_Movement.findOne({
                where: { id: req.params.id, ...companyFilter(req) },
                include: [
                    { model: Product,   attributes: ['id', 'name', 'sku'] },
                    { model: Warehouse, attributes: ['id', 'name'] }
                ]
            });
            if (!movement) throw { name: 'NotFound', message: 'Stock movement not found' };
            res.status(200).json(movement);
        } catch (err) { next(err); }
    }

    static async create(req, res, next) {
        try {
            const movement = await Stock_Movement.create({ ...req.body, companyId: companyId(req) });
            res.status(201).json(movement);
        } catch (err) { next(err); }
    }

    static async delete(req, res, next) {
        try {
            const movement = await Stock_Movement.findOne({ where: { id: req.params.id, ...companyFilter(req) } });
            if (!movement) throw { name: 'NotFound', message: 'Stock movement not found' };
            await movement.destroy();
            res.status(200).json({ message: 'Stock movement deleted successfully' });
        } catch (err) { next(err); }
    }

    static async getSummary(req, res, next) {
        try {
            const filter = buildFilter(req.query, {
                type:        'exact',
                ProductId:   'exact',
                WarehouseId: 'exact',
                dateFrom:    { field: 'createdAt', type: 'gte' },
                dateTo:      { field: 'createdAt', type: 'lte' },
            });
            const base = { ...companyFilter(req), ...filter };

            const [inRow, outRow, adjRow] = await Promise.all([
                Stock_Movement.sum('quantity', { where: { ...base, type: 'IN' } }),
                Stock_Movement.sum('quantity', { where: { ...base, type: 'OUT' } }),
                Stock_Movement.sum('quantity', { where: { ...base, type: 'ADJUSTMENT' } }),
            ]);

            const totalIn  = inRow  || 0;
            const totalOut = outRow || 0;
            const totalAdj = adjRow || 0;
            res.json({ totalIn, totalOut, totalAdj, net: totalIn - totalOut });
        } catch (err) { next(err); }
    }

    static async getChart(req, res, next) {
        try {
            const filter = buildFilter(req.query, {
                ProductId:   'exact',
                WarehouseId: 'exact',
                dateFrom:    { field: 'createdAt', type: 'gte' },
                dateTo:      { field: 'createdAt', type: 'lte' },
            });
            const rows = await Stock_Movement.findAll({
                where: { ...companyFilter(req), ...filter },
                attributes: [
                    [fn('DATE', col('createdAt')), 'date'],
                    'type',
                    [fn('SUM', col('quantity')), 'total'],
                ],
                group: [fn('DATE', col('createdAt')), 'type'],
                order: [[fn('DATE', col('createdAt')), 'ASC']],
                raw: true,
            });

            // pivot into { date, IN, OUT, ADJUSTMENT }
            const map = {};
            for (const r of rows) {
                if (!map[r.date]) map[r.date] = { date: r.date, IN: 0, OUT: 0, ADJUSTMENT: 0 };
                map[r.date][r.type] = Number(r.total);
            }
            res.json(Object.values(map));
        } catch (err) { next(err); }
    }

    static async exportCsv(req, res, next) {
        try {
            const filter = buildFilter(req.query, {
                type:        'exact',
                ProductId:   'exact',
                WarehouseId: 'exact',
                dateFrom:    { field: 'createdAt', type: 'gte' },
                dateTo:      { field: 'createdAt', type: 'lte' },
            });
            const rows = await Stock_Movement.findAll({
                where: { ...companyFilter(req), ...filter },
                include: [
                    { model: Product,   attributes: ['name', 'sku'] },
                    { model: Warehouse, attributes: ['name'] },
                    {
                        model: ProductSKU, attributes: ['sku_code'], required: false,
                        include: [{ model: ProductVariantOption, attributes: ['value'], through: { attributes: [] } }]
                    },
                ],
                order: [['createdAt', 'DESC']],
                limit: 5000,
            });

            const header = 'Date,Type,Product,SKU Produk,SKU Varian,Varian,Warehouse,Quantity,Note,Ref\n';
            const body = rows.map(r => {
                const opts    = r.ProductSKU?.ProductVariantOptions ?? [];
                const variant = opts.map(o => o.value).join(' / ');
                return [
                    new Date(r.createdAt).toISOString(),
                    r.type,
                    `"${r.Product?.name ?? ''}"`,
                    r.Product?.sku ?? '',
                    r.ProductSKU?.sku_code ?? '',
                    `"${variant}"`,
                    `"${r.Warehouse?.name ?? ''}"`,
                    r.quantity,
                    `"${r.note ?? ''}"`,
                    r.ReferenceId ?? '',
                ].join(',')
            }).join('\n');

            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename="movements.csv"');
            res.send(header + body);
        } catch (err) { next(err); }
    }
}

module.exports = StockMovementController;
