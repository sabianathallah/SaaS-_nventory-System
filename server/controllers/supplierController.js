'use strict';
const { Supplier } = require('../models');
const { companyFilter, companyId } = require('../helpers/tenancy');
const { paginate, buildFilter, paginatedResponse } = require('../helpers/queryHelper');

class SupplierController {
    static async getAll(req, res, next) {
        try {
            const { page, limit, offset } = paginate(req.query);
            const filter = buildFilter(req.query, { name: 'like' });
            const { rows, count } = await Supplier.findAndCountAll({
                where: { ...companyFilter(req), ...filter },
                order: [['name', 'ASC']],
                limit, offset
            });
            res.status(200).json(paginatedResponse(rows, count, page, limit));
        } catch (err) { next(err); }
    }

    static async getById(req, res, next) {
        try {
            const supplier = await Supplier.findOne({ where: { id: req.params.id, ...companyFilter(req) } });
            if (!supplier) throw { name: 'NotFound', message: 'Supplier not found' };
            res.status(200).json(supplier);
        } catch (err) { next(err); }
    }

    static async create(req, res, next) {
        try {
            const supplier = await Supplier.create({ ...req.body, companyId: companyId(req) });
            res.status(201).json(supplier);
        } catch (err) { next(err); }
    }

    static async update(req, res, next) {
        try {
            const supplier = await Supplier.findOne({ where: { id: req.params.id, ...companyFilter(req) } });
            if (!supplier) throw { name: 'NotFound', message: 'Supplier not found' };
            await supplier.update(req.body);
            res.status(200).json(supplier);
        } catch (err) { next(err); }
    }

    static async delete(req, res, next) {
        try {
            const supplier = await Supplier.findOne({ where: { id: req.params.id, ...companyFilter(req) } });
            if (!supplier) throw { name: 'NotFound', message: 'Supplier not found' };
            await supplier.destroy();
            res.status(200).json({ message: 'Supplier deleted successfully' });
        } catch (err) { next(err); }
    }
}

module.exports = SupplierController;
