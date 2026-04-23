'use strict';
const { FormAnakPacking, PackingJob, IncomingGoods, User } = require('../models');
const { companyFilter } = require('../helpers/tenancy');
const { paginate, buildFilter, paginatedResponse } = require('../helpers/queryHelper');

class FormAnakPackingController {
    static async getAll(req, res, next) {
        try {
            const { page, limit, offset } = paginate(req.query);
            const filter = buildFilter(req.query, {
                workerId: 'exact',
                dateFrom: { field: 'generatedAt', type: 'gte' },
                dateTo:   { field: 'generatedAt', type: 'lte' },
            });
            const selfFilter = req.user.role === 'TIM_PACKING' ? { workerId: req.user.id } : {};
            const { rows, count } = await FormAnakPacking.findAndCountAll({
                where: { ...companyFilter(req), ...filter, ...selfFilter },
                include: [
                    { model: User, as: 'worker',         attributes: ['id', 'name'] },
                    { model: User, as: 'generatedByUser', attributes: ['id', 'name'] },
                    {
                        model: PackingJob,
                        attributes: ['id'],
                        include: [{ model: IncomingGoods, as: 'incomingGoods', attributes: ['id', 'docNumber'] }],
                    },
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
            const selfFilter = req.user.role === 'TIM_PACKING' ? { workerId: req.user.id } : {};
            const form = await FormAnakPacking.findOne({
                where: { id: req.params.id, ...companyFilter(req), ...selfFilter },
                include: [
                    { model: User, as: 'worker',         attributes: ['id', 'name'] },
                    { model: User, as: 'generatedByUser', attributes: ['id', 'name'] },
                    {
                        model: PackingJob,
                        attributes: ['id'],
                        include: [{ model: IncomingGoods, as: 'incomingGoods', attributes: ['id', 'docNumber', 'receivedDate'] }],
                    },
                ],
            });
            if (!form) throw { name: 'NotFound', message: 'Form Anak Packing not found' };
            res.status(200).json(form);
        } catch (err) { next(err); }
    }
}

module.exports = FormAnakPackingController;
