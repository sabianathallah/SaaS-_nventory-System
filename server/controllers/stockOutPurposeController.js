'use strict';
const { StockOutPurpose } = require('../models');
const { companyFilter, companyId } = require('../helpers/tenancy');
const { paginate, buildFilter, paginatedResponse } = require('../helpers/queryHelper');

class StockOutPurposeController {
    static async getAll(req, res, next) {
        try {
            const { page, limit, offset } = paginate(req.query);
            const filter = buildFilter(req.query, { name: 'like', isActive: 'exact' });
            const { rows, count } = await StockOutPurpose.findAndCountAll({
                where: { ...companyFilter(req), ...filter },
                order: [['name', 'ASC']],
                limit, offset
            });
            res.status(200).json(paginatedResponse(rows, count, page, limit));
        } catch (err) { next(err); }
    }

    static async getById(req, res, next) {
        try {
            const purpose = await StockOutPurpose.findOne({ where: { id: req.params.id, ...companyFilter(req) } });
            if (!purpose) throw { name: 'NotFound', message: 'Purpose not found' };
            res.status(200).json(purpose);
        } catch (err) { next(err); }
    }

    static async create(req, res, next) {
        try {
            const name = (req.body.name || '').trim();
            if (!name) throw { name: 'BadRequest', message: 'Nama tujuan wajib diisi' };
            const purpose = await StockOutPurpose.create({ name, companyId: companyId(req) });
            res.status(201).json(purpose);
        } catch (err) { next(err); }
    }

    static async update(req, res, next) {
        try {
            const purpose = await StockOutPurpose.findOne({ where: { id: req.params.id, ...companyFilter(req) } });
            if (!purpose) throw { name: 'NotFound', message: 'Purpose not found' };
            await purpose.update(req.body);
            res.status(200).json(purpose);
        } catch (err) { next(err); }
    }

    static async delete(req, res, next) {
        try {
            const purpose = await StockOutPurpose.findOne({ where: { id: req.params.id, ...companyFilter(req) } });
            if (!purpose) throw { name: 'NotFound', message: 'Purpose not found' };
            await purpose.destroy();
            res.status(200).json({ message: 'Purpose deleted successfully' });
        } catch (err) { next(err); }
    }
}

module.exports = StockOutPurposeController;
