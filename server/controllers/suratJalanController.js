'use strict';
const { SuratJalan, IncomingGoods, Vendor, User } = require('../models');
const { companyFilter } = require('../helpers/tenancy');
const { paginate, buildFilter, paginatedResponse } = require('../helpers/queryHelper');

class SuratJalanController {
    static async getAll(req, res, next) {
        try {
            const { page, limit, offset } = paginate(req.query);
            const filter = buildFilter(req.query, {
                dateFrom: { field: 'generatedAt', type: 'gte' },
                dateTo:   { field: 'generatedAt', type: 'lte' },
            });
            const { rows, count } = await SuratJalan.findAndCountAll({
                where: { ...companyFilter(req), ...filter },
                include: [
                    {
                        model: IncomingGoods,
                        attributes: ['id', 'docNumber', 'receivedDate'],
                        include: [{ model: Vendor, attributes: ['id', 'name'] }],
                    },
                    { model: User, as: 'generatedByUser', attributes: ['id', 'name'] },
                ],
                order: [['generatedAt', 'DESC']],
                limit, offset,
                distinct: true,
            });
            res.status(200).json(paginatedResponse(rows, count, page, limit));
        } catch (err) { next(err); }
    }

    static async getById(req, res, next) {
        try {
            const sj = await SuratJalan.findOne({
                where: { id: req.params.id, ...companyFilter(req) },
                include: [
                    {
                        model: IncomingGoods,
                        attributes: ['id', 'docNumber', 'receivedDate'],
                        include: [{ model: Vendor, attributes: ['id', 'name', 'vendorCode'] }],
                    },
                    { model: User, as: 'generatedByUser', attributes: ['id', 'name'] },
                ],
            });
            if (!sj) throw { name: 'NotFound', message: 'Surat Jalan not found' };
            res.status(200).json(sj);
        } catch (err) { next(err); }
    }

    static async markPrinted(req, res, next) {
        try {
            const sj = await SuratJalan.findOne({ where: { id: req.params.id, ...companyFilter(req) } });
            if (!sj) throw { name: 'NotFound', message: 'Surat Jalan not found' };
            if (!sj.printedAt) {
                await sj.update({ printedAt: new Date() });
            }
            res.status(200).json({ message: 'Marked as printed', printedAt: sj.printedAt });
        } catch (err) { next(err); }
    }
}

module.exports = SuratJalanController;
