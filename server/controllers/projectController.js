'use strict';
const { Project, Task, User, sequelize } = require('../models');
const { Op } = require('sequelize');
const { companyFilter, companyId } = require('../helpers/tenancy');
const { userHasPermission } = require('../helpers/permCheck');

const USER_ATTRS = ['id', 'name', 'email', 'divisi'];
const PROJECT_INCLUDE = [
    { model: User, as: 'owner',   attributes: USER_ATTRS },
    { model: User, as: 'creator', attributes: USER_ATTRS },
];

// Task totals are counted in SQL rather than by eager-loading every task —
// the grid only ever renders "12/20" + a progress bar, so pulling the rows
// themselves would be wasted work on a project with hundreds of tasks.
// Sub-tasks are excluded ("parentTaskId" IS NULL) so a project's progress
// counts the actual work items, matching what the board/list views show.
const COUNT_ATTRS = {
    include: [
        [
            sequelize.literal('(SELECT COUNT(*) FROM "Tasks" WHERE "Tasks"."projectId" = "Project"."id" AND "Tasks"."parentTaskId" IS NULL)'),
            'taskCount',
        ],
        [
            sequelize.literal(`(SELECT COUNT(*) FROM "Tasks" WHERE "Tasks"."projectId" = "Project"."id" AND "Tasks"."parentTaskId" IS NULL AND "Tasks"."status" = 'DONE')`),
            'doneCount',
        ],
    ],
};

// Projects are a company-wide, cross-divisi object, so there's no per-divisi
// gate like TaskLists have — anyone in the company can see and create one,
// but only its owner/creator (or a task admin) may edit or delete it.
async function canManageProject(req, project) {
    if (project.createdBy === req.user.id) return true;
    if (project.ownerId && project.ownerId === req.user.id) return true;
    if (req.user.role === 'SUPER_ADMIN' || req.user.role === 'COMPANY_ADMIN') return true;
    if (await userHasPermission(req, 'tasks.manage')) return true;
    if (await userHasPermission(req, 'tasks.edit')) return true;
    return false;
}

class ProjectController {
    static async list(req, res, next) {
        try {
            const where = { ...companyFilter(req) };
            if (req.query.status) where.status = req.query.status;
            if (req.query.q) where.name = { [Op.iLike]: `%${req.query.q}%` };

            const projects = await Project.findAll({
                where,
                attributes: COUNT_ATTRS,
                include: PROJECT_INCLUDE,
                // Aktif dulu, arsip (DONE) terakhir — lalu deadline terdekat.
                order: [
                    [sequelize.literal(`CASE "Project"."status" WHEN 'ACTIVE' THEN 0 WHEN 'PLANNING' THEN 1 WHEN 'ON_HOLD' THEN 2 ELSE 3 END`), 'ASC'],
                    ['dueDate', 'ASC NULLS LAST'],
                    ['createdAt', 'DESC'],
                ],
            });
            res.json(projects);
        } catch (err) { next(err); }
    }

    static async show(req, res, next) {
        try {
            const project = await Project.findOne({
                where: { id: req.params.id, ...companyFilter(req) },
                attributes: COUNT_ATTRS,
                include: PROJECT_INCLUDE,
            });
            if (!project) throw { name: 'NotFound', message: 'Project tidak ditemukan' };
            res.json(project);
        } catch (err) { next(err); }
    }

    static async create(req, res, next) {
        try {
            const { name, description, color, icon, status, startDate, dueDate, ownerId } = req.body;
            if (!name) throw { name: 'BadRequest', message: 'Nama project wajib diisi' };

            const project = await Project.create({
                name,
                description: description || null,
                color: color || '#C8102E',
                icon: icon || null,
                status: status || 'ACTIVE',
                startDate: startDate || null,
                dueDate: dueDate || null,
                ownerId: ownerId || req.user.id,
                createdBy: req.user.id,
                companyId: companyId(req) ?? req.user.companyId,
            });
            const full = await Project.findByPk(project.id, { attributes: COUNT_ATTRS, include: PROJECT_INCLUDE });
            res.status(201).json(full);
        } catch (err) { next(err); }
    }

    static async update(req, res, next) {
        try {
            const project = await Project.findOne({ where: { id: req.params.id, ...companyFilter(req) } });
            if (!project) throw { name: 'NotFound', message: 'Project tidak ditemukan' };
            if (!(await canManageProject(req, project))) {
                throw { name: 'Forbidden', message: 'Anda tidak punya akses untuk mengubah project ini' };
            }
            const { name, description, color, icon, status, startDate, dueDate, ownerId } = req.body;
            await project.update({
                name:        name ?? project.name,
                description: description === undefined ? project.description : (description || null),
                color:       color ?? project.color,
                icon:        icon === undefined ? project.icon : icon,
                status:      status ?? project.status,
                startDate:   startDate === undefined ? project.startDate : (startDate || null),
                dueDate:     dueDate === undefined ? project.dueDate : (dueDate || null),
                ownerId:     ownerId === undefined ? project.ownerId : (ownerId || null),
            });
            const full = await Project.findByPk(project.id, { attributes: COUNT_ATTRS, include: PROJECT_INCLUDE });
            res.json(full);
        } catch (err) { next(err); }
    }

    static async destroy(req, res, next) {
        try {
            const project = await Project.findOne({ where: { id: req.params.id, ...companyFilter(req) } });
            if (!project) throw { name: 'NotFound', message: 'Project tidak ditemukan' };
            if (!(await canManageProject(req, project))) {
                throw { name: 'Forbidden', message: 'Anda tidak punya akses untuk menghapus project ini' };
            }
            // Tasks survive their project (FK is ON DELETE SET NULL) — deleting
            // a project only un-groups its tasks, it never deletes work.
            const released = await Task.count({ where: { projectId: project.id } });
            await project.destroy();
            res.json({ message: `Project dihapus — ${released} task dilepas dari project ini` });
        } catch (err) { next(err); }
    }
}

module.exports = ProjectController;
