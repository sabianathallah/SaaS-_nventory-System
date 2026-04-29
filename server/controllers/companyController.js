'use strict';
const { Company, User } = require('../models');
const { paginate, buildFilter, paginatedResponse } = require('../helpers/queryHelper');
const { destroyByUrl } = require('../helpers/cloudinary');

class CompanyController {
    static async getAll(req, res, next) {
        try {
            const { page, limit, offset } = paginate(req.query);
            const filter = buildFilter(req.query, {
                name:   'like',
                status: 'exact',
            });
            const { rows, count } = await Company.findAndCountAll({
                where: filter,
                order: [['name', 'ASC']],
                limit, offset
            });
            res.status(200).json(paginatedResponse(rows, count, page, limit));
        } catch (err) { next(err); }
    }

    static async getById(req, res, next) {
        try {
            const company = await Company.findByPk(req.params.id, {
                include: [{ model: User, attributes: ['id', 'name', 'email', 'role', 'isActive'] }]
            });
            if (!company) throw { name: 'NotFound', message: 'Company not found' };
            res.status(200).json(company);
        } catch (err) { next(err); }
    }

    static async create(req, res, next) {
        try {
            const payload = { ...req.body };
            delete payload.logoPreview;
            if (req.file?.path) payload.logo = req.file.path;
            const company = await Company.create(payload);
            res.status(201).json(company);
        } catch (err) {
            if (req.file?.path) destroyByUrl(req.file.path);
            next(err);
        }
    }

    static async update(req, res, next) {
        try {
            const company = await Company.findByPk(req.params.id);
            if (!company) throw { name: 'NotFound', message: 'Company not found' };
            const updates = { ...req.body };
            delete updates.logoPreview;
            let oldLogo = null;
            if (req.file?.path) {
                oldLogo = company.logo;
                updates.logo = req.file.path;
            }
            await company.update(updates);
            if (oldLogo) destroyByUrl(oldLogo);
            res.status(200).json(company);
        } catch (err) {
            if (req.file?.path) destroyByUrl(req.file.path);
            next(err);
        }
    }

    static async delete(req, res, next) {
        try {
            const company = await Company.findByPk(req.params.id);
            if (!company) throw { name: 'NotFound', message: 'Company not found' };
            await company.destroy();
            res.status(200).json({ message: 'Company deleted successfully' });
        } catch (err) { next(err); }
    }
}

module.exports = CompanyController;
