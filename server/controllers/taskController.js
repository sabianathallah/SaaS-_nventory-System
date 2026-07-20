'use strict';
const { Task, TaskComment, Notification, User, sequelize } = require('../models');
const { companyFilter, companyId } = require('../helpers/tenancy');
const { paginate, buildFilter, paginatedResponse } = require('../helpers/queryHelper');
const { userHasPermission } = require('../helpers/permCheck');

const USER_ATTRS = ['id', 'name', 'email', 'divisi'];

async function notify(userId, { type, title, message, link, companyId: cid }) {
    if (!userId) return;
    await Notification.create({ userId, type, title, message, link: link || null, companyId: cid ?? null });
}

class TaskController {
    static async list(req, res, next) {
        try {
            const { page, limit, offset } = paginate(req.query);
            const filter = buildFilter(req.query, { status: 'exact', priority: 'exact', assigneeId: 'exact' });
            const { Op } = require('sequelize');

            const canViewAll = await userHasPermission(req, 'tasks.view');

            // `view` drives the sidebar (San-Group-style named views); falls back to the
            // older `mine`/plain-filter behavior when absent so existing callers keep working.
            const view = req.query.view;
            let viewFilter = {};
            if (view === 'my_day') {
                viewFilter = { myDayDate: new Date().toISOString().slice(0, 10) };
            } else if (view === 'important') {
                viewFilter = { isImportant: true };
            } else if (view === 'assigned') {
                viewFilter = { assigneeId: req.user.id };
            } else if (view === 'created') {
                viewFilter = { createdBy: req.user.id };
            } else if (view === 'completed') {
                viewFilter = { status: 'DONE' };
            }
            // 'all' (or unrecognized) leaves viewFilter empty — scope decided below.

            const ownFilter = req.query.mine === 'true'
                ? { assigneeId: req.user.id }
                : (canViewAll ? {} : {
                    [Op.or]: [{ assigneeId: req.user.id }, { createdBy: req.user.id }],
                });

            const { rows, count } = await Task.findAndCountAll({
                where: { ...companyFilter(req), ...filter, ...viewFilter, ...ownFilter },
                attributes: {
                    include: [[
                        sequelize.literal('(SELECT COUNT(*) FROM "TaskComments" WHERE "TaskComments"."taskId" = "Task"."id")'),
                        'commentCount',
                    ]],
                },
                include: [
                    { model: User, as: 'assignee', attributes: USER_ATTRS },
                    { model: User, as: 'creator', attributes: USER_ATTRS },
                ],
                order: [['createdAt', 'DESC']],
                limit, offset,
                distinct: true,
            });
            res.json(paginatedResponse(rows, count, page, limit));
        } catch (err) { next(err); }
    }

    static async create(req, res, next) {
        try {
            const { title, description, status, priority, dueDate, assigneeId, isImportant, myDayDate } = req.body;
            if (!title) throw { name: 'BadRequest', message: 'title wajib diisi' };

            const task = await Task.create({
                title,
                description: description || null,
                status: status || 'TODO',
                priority: priority || 'MEDIUM',
                dueDate: dueDate || null,
                assigneeId: assigneeId || null,
                createdBy: req.user.id,
                companyId: companyId(req) ?? req.user.companyId,
                isImportant: !!isImportant,
                myDayDate: myDayDate || null,
            });

            if (assigneeId && Number(assigneeId) !== req.user.id) {
                await notify(assigneeId, {
                    type: 'TASK_ASSIGNED',
                    title: 'Task baru ditugaskan',
                    message: `${req.user.name} menugaskan task "${title}" kepada Anda`,
                    link: `/tasks?open=${task.id}`,
                    companyId: task.companyId,
                });
            }

            const full = await Task.findByPk(task.id, {
                include: [
                    { model: User, as: 'assignee', attributes: USER_ATTRS },
                    { model: User, as: 'creator', attributes: USER_ATTRS },
                ],
            });
            res.status(201).json(full);
        } catch (err) { next(err); }
    }

    static async update(req, res, next) {
        try {
            const canEditAll = await userHasPermission(req, 'tasks.edit');
            const task = await Task.findOne({ where: { id: req.params.id, ...companyFilter(req) } });
            if (!task) throw { name: 'NotFound', message: 'Task tidak ditemukan' };
            if (!canEditAll && task.createdBy !== req.user.id && task.assigneeId !== req.user.id) {
                throw { name: 'Forbidden', message: 'Anda tidak punya akses untuk mengubah task ini' };
            }

            const { title, description, status, priority, dueDate, assigneeId, isImportant, myDayDate } = req.body;
            const prevAssigneeId = task.assigneeId;

            await task.update({
                title: title ?? task.title,
                description: description ?? task.description,
                status: status ?? task.status,
                priority: priority ?? task.priority,
                dueDate: dueDate === undefined ? task.dueDate : dueDate,
                assigneeId: assigneeId === undefined ? task.assigneeId : (assigneeId || null),
                isImportant: isImportant === undefined ? task.isImportant : !!isImportant,
                myDayDate: myDayDate === undefined ? task.myDayDate : myDayDate,
            });

            if (assigneeId !== undefined && Number(assigneeId) !== prevAssigneeId && assigneeId && Number(assigneeId) !== req.user.id) {
                await notify(assigneeId, {
                    type: 'TASK_ASSIGNED',
                    title: 'Task ditugaskan kepada Anda',
                    message: `${req.user.name} menugaskan task "${task.title}" kepada Anda`,
                    link: `/tasks?open=${task.id}`,
                    companyId: task.companyId,
                });
            }

            const full = await Task.findByPk(task.id, {
                include: [
                    { model: User, as: 'assignee', attributes: USER_ATTRS },
                    { model: User, as: 'creator', attributes: USER_ATTRS },
                ],
            });
            res.json(full);
        } catch (err) { next(err); }
    }

    static async destroy(req, res, next) {
        try {
            const canEditAll = await userHasPermission(req, 'tasks.delete');
            const task = await Task.findOne({ where: { id: req.params.id, ...companyFilter(req) } });
            if (!task) throw { name: 'NotFound', message: 'Task tidak ditemukan' };
            if (!canEditAll && task.createdBy !== req.user.id) {
                throw { name: 'Forbidden', message: 'Anda tidak punya akses untuk menghapus task ini' };
            }
            await task.destroy();
            res.json({ message: 'Task dihapus' });
        } catch (err) { next(err); }
    }

    static async listComments(req, res, next) {
        try {
            const task = await Task.findOne({ where: { id: req.params.id, ...companyFilter(req) } });
            if (!task) throw { name: 'NotFound', message: 'Task tidak ditemukan' };
            const comments = await TaskComment.findAll({
                where: { taskId: task.id },
                include: [{ model: User, as: 'user', attributes: USER_ATTRS }],
                order: [['createdAt', 'ASC']],
            });
            res.json(comments);
        } catch (err) { next(err); }
    }

    static async addComment(req, res, next) {
        try {
            const { content } = req.body;
            if (!content) throw { name: 'BadRequest', message: 'content wajib diisi' };

            const task = await Task.findOne({ where: { id: req.params.id, ...companyFilter(req) } });
            if (!task) throw { name: 'NotFound', message: 'Task tidak ditemukan' };

            const comment = await TaskComment.create({ taskId: task.id, userId: req.user.id, content });

            const recipients = new Set([task.assigneeId, task.createdBy].filter(Boolean));
            recipients.delete(req.user.id);
            for (const recipientId of recipients) {
                await notify(recipientId, {
                    type: 'TASK_COMMENT',
                    title: 'Komentar baru pada task',
                    message: `${req.user.name} berkomentar pada task "${task.title}"`,
                    link: `/tasks?open=${task.id}`,
                    companyId: task.companyId,
                });
            }

            const full = await TaskComment.findByPk(comment.id, {
                include: [{ model: User, as: 'user', attributes: USER_ATTRS }],
            });
            res.status(201).json(full);
        } catch (err) { next(err); }
    }
}

module.exports = TaskController;
