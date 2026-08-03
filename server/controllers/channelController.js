'use strict';
const { Channel } = require('../models');
const { companyFilter, companyId } = require('../helpers/tenancy');
const { paginate, buildFilter, paginatedResponse } = require('../helpers/queryHelper');

class ChannelController {
    static async getAll(req, res, next) {
        try {
            const { page, limit, offset } = paginate(req.query);
            const filter = buildFilter(req.query, { name: 'like', isActive: 'exact' });
            const { rows, count } = await Channel.findAndCountAll({
                where: { ...companyFilter(req), ...filter },
                order: [['name', 'ASC']],
                limit, offset
            });
            res.status(200).json(paginatedResponse(rows, count, page, limit));
        } catch (err) { next(err); }
    }

    static async getById(req, res, next) {
        try {
            const channel = await Channel.findOne({ where: { id: req.params.id, ...companyFilter(req) } });
            if (!channel) throw { name: 'NotFound', message: 'Channel not found' };
            res.status(200).json(channel);
        } catch (err) { next(err); }
    }

    static async create(req, res, next) {
        try {
            const channel = await Channel.create({ ...req.body, companyId: companyId(req) });
            res.status(201).json(channel);
        } catch (err) { next(err); }
    }

    static async update(req, res, next) {
        try {
            const channel = await Channel.findOne({ where: { id: req.params.id, ...companyFilter(req) } });
            if (!channel) throw { name: 'NotFound', message: 'Channel not found' };
            await channel.update(req.body);
            res.status(200).json(channel);
        } catch (err) { next(err); }
    }

    static async delete(req, res, next) {
        try {
            const channel = await Channel.findOne({ where: { id: req.params.id, ...companyFilter(req) } });
            if (!channel) throw { name: 'NotFound', message: 'Channel not found' };
            await channel.destroy();
            res.status(200).json({ message: 'Channel deleted successfully' });
        } catch (err) { next(err); }
    }
}

module.exports = ChannelController;
