'use strict';
const { TaskList } = require('../models');
const { companyFilter, companyId } = require('../helpers/tenancy');

class TaskListController {
    static async list(req, res, next) {
        try {
            const lists = await TaskList.findAll({
                where: { userId: req.user.id, ...companyFilter(req) },
                order: [['createdAt', 'ASC']],
            });
            res.json(lists);
        } catch (err) { next(err); }
    }

    static async create(req, res, next) {
        try {
            const { name, color, icon } = req.body;
            if (!name) throw { name: 'BadRequest', message: 'name wajib diisi' };
            const list = await TaskList.create({
                name,
                color: color || '#C8102E',
                icon: icon || null,
                userId: req.user.id,
                companyId: companyId(req) ?? req.user.companyId,
            });
            res.status(201).json(list);
        } catch (err) { next(err); }
    }

    static async update(req, res, next) {
        try {
            const list = await TaskList.findOne({ where: { id: req.params.id, userId: req.user.id, ...companyFilter(req) } });
            if (!list) throw { name: 'NotFound', message: 'List tidak ditemukan' };
            const { name, color, icon } = req.body;
            await list.update({
                name: name ?? list.name,
                color: color ?? list.color,
                icon: icon === undefined ? list.icon : icon,
            });
            res.json(list);
        } catch (err) { next(err); }
    }

    static async destroy(req, res, next) {
        try {
            const list = await TaskList.findOne({ where: { id: req.params.id, userId: req.user.id, ...companyFilter(req) } });
            if (!list) throw { name: 'NotFound', message: 'List tidak ditemukan' };
            await list.destroy();
            res.json({ message: 'List dihapus' });
        } catch (err) { next(err); }
    }
}

module.exports = TaskListController;
