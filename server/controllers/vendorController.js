'use strict';
const { Vendor } = require('../models');
const { companyFilter, companyId } = require('../helpers/tenancy');
const { paginate, buildFilter, paginatedResponse } = require('../helpers/queryHelper');

class VendorController {
    static async getAll(req, res, next) {
        try {
            const { page, limit, offset } = paginate(req.query);
            const filter = buildFilter(req.query, {
                name:       'like',
                vendorCode: 'like',
            });
            const { rows, count } = await Vendor.findAndCountAll({
                where: { ...companyFilter(req), ...filter },
                order: [['name', 'ASC']],
                limit, offset,
                distinct: true,
            });
            res.status(200).json(paginatedResponse(rows, count, page, limit));
        } catch (err) { next(err); }
    }

    static async getById(req, res, next) {
        try {
            const vendor = await Vendor.findOne({
                where: { id: req.params.id, ...companyFilter(req) },
            });
            if (!vendor) throw { name: 'NotFound', message: 'Vendor not found' };
            res.status(200).json(vendor);
        } catch (err) { next(err); }
    }

    static async create(req, res, next) {
        try {
            const vendor = await Vendor.create({ ...req.body, companyId: companyId(req) });
            res.status(201).json(vendor);
        } catch (err) { next(err); }
    }

    static async update(req, res, next) {
        try {
            const vendor = await Vendor.findOne({ where: { id: req.params.id, ...companyFilter(req) } });
            if (!vendor) throw { name: 'NotFound', message: 'Vendor not found' };
            await vendor.update(req.body);
            res.status(200).json(vendor);
        } catch (err) { next(err); }
    }

    static async delete(req, res, next) {
        try {
            const vendor = await Vendor.findOne({ where: { id: req.params.id, ...companyFilter(req) } });
            if (!vendor) throw { name: 'NotFound', message: 'Vendor not found' };
            await vendor.destroy();
            res.status(200).json({ message: 'Vendor deleted successfully' });
        } catch (err) { next(err); }
    }
}

module.exports = VendorController;
