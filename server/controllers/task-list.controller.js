'use strict';
const { TaskList } = require('../models');
const { companyFilter, companyId } = require('../helpers/tenancy');
const { canManageDivisi } = require('../helpers/divisiAccess');

class TaskListController {
    static async list(req, res, next) {
        try {
            const { divisi } = req.query;
            if (!divisi) throw { name: 'BadRequest', message: 'divisi wajib diisi' };
            const lists = await TaskList.findAll({
                where: { divisi, ...companyFilter(req) },
                order: [['createdAt', 'ASC']],
            });
            res.json(lists);
        } catch (err) { next(err); }
    }

    static async create(req, res, next) {
        try {
            const { name, color, icon, divisi } = req.body;
            if (!name) throw { name: 'BadRequest', message: 'name wajib diisi' };
            if (!divisi) throw { name: 'BadRequest', message: 'divisi wajib diisi' };
            if (!(await canManageDivisi(req, divisi))) {
                throw { name: 'Forbidden', message: 'Anda tidak punya akses untuk membuat list di divisi ini' };
            }
            const list = await TaskList.create({
                name,
                color: color || '#C8102E',
                icon: icon || null,
                divisi,
                userId: req.user.id,
                companyId: companyId(req) ?? req.user.companyId,
            });
            res.status(201).json(list);
        } catch (err) { next(err); }
    }

    static async update(req, res, next) {
        try {
            const list = await TaskList.findOne({ where: { id: req.params.id, ...companyFilter(req) } });
            if (!list) throw { name: 'NotFound', message: 'List tidak ditemukan' };
            if (!(await canManageDivisi(req, list.divisi))) {
                throw { name: 'Forbidden', message: 'Anda tidak punya akses untuk mengubah list ini' };
            }
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
            const list = await TaskList.findOne({ where: { id: req.params.id, ...companyFilter(req) } });
            if (!list) throw { name: 'NotFound', message: 'List tidak ditemukan' };
            if (!(await canManageDivisi(req, list.divisi))) {
                throw { name: 'Forbidden', message: 'Anda tidak punya akses untuk menghapus list ini' };
            }
            await list.destroy();
            res.json({ message: 'List dihapus' });
        } catch (err) { next(err); }
    }
}

module.exports = TaskListController;
