'use strict';
const { Task, TaskComment, TaskList, Notification, User, sequelize } = require('../models');
const { companyFilter, companyId } = require('../helpers/tenancy');
const { paginate, buildFilter, paginatedResponse } = require('../helpers/queryHelper');
const { userHasPermission } = require('../helpers/permCheck');
const { addDaysStr, weekdayOf } = require('../helpers/timezone');

const USER_ATTRS = ['id', 'name', 'email', 'divisi'];
const TASK_INCLUDE = [
    { model: User, as: 'assignee', attributes: USER_ATTRS },
    { model: User, as: 'creator', attributes: USER_ATTRS },
    { model: TaskList, as: 'list', attributes: ['id', 'name', 'color', 'icon'] },
];

const SORT_MAP = {
    title:    [['title', 'ASC']],
    dueDate:  [['dueDate', 'ASC']],
    priority: [[sequelize.literal(`CASE "Task"."priority" WHEN 'HIGH' THEN 0 WHEN 'MEDIUM' THEN 1 ELSE 2 END`), 'ASC']],
    created:  [['createdAt', 'DESC']],
};

// Recurrence presets are fixed (no custom RRULE) — advances dueDate by the
// rule's cadence, skipping weekends for WEEKDAYS.
function nextDueDate(dueDate, recurrence) {
    if (!dueDate) return null;
    if (recurrence === 'DAILY') return addDaysStr(dueDate, 1);
    if (recurrence === 'WEEKLY') return addDaysStr(dueDate, 7);
    if (recurrence === 'WEEKDAYS') {
        let next = addDaysStr(dueDate, 1);
        while (weekdayOf(next) === 0 || weekdayOf(next) === 6) next = addDaysStr(next, 1);
        return next;
    }
    return null;
}

async function notify(userId, { type, title, message, link, companyId: cid }) {
    if (!userId) return;
    await Notification.create({ userId, type, title, message, link: link || null, companyId: cid ?? null });
}

class TaskController {
    static async list(req, res, next) {
        try {
            const { page, limit, offset } = paginate(req.query);
            const filter = buildFilter(req.query, { status: 'exact', priority: 'exact', assigneeId: 'exact', listId: 'exact' });
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

            // Top-level views only ever show parent tasks — sub-tasks are fetched
            // explicitly via ?parentTaskId=<id> (mirrors the listComments pattern
            // rather than a dedicated route) from the detail panel's Sub-tasks tab.
            const parentFilter = req.query.parentTaskId
                ? { parentTaskId: req.query.parentTaskId }
                : { parentTaskId: null };

            const { rows, count } = await Task.findAndCountAll({
                where: { ...companyFilter(req), ...filter, ...viewFilter, ...ownFilter, ...parentFilter },
                attributes: {
                    include: [
                        [
                            sequelize.literal('(SELECT COUNT(*) FROM "TaskComments" WHERE "TaskComments"."taskId" = "Task"."id")'),
                            'commentCount',
                        ],
                        [
                            sequelize.literal('(SELECT COUNT(*) FROM "Tasks" AS "st" WHERE "st"."parentTaskId" = "Task"."id")'),
                            'subTaskCount',
                        ],
                    ],
                },
                include: TASK_INCLUDE,
                order: SORT_MAP[req.query.sortBy] || [['createdAt', 'DESC']],
                limit, offset,
                distinct: true,
            });
            res.json(paginatedResponse(rows, count, page, limit));
        } catch (err) { next(err); }
    }

    static async create(req, res, next) {
        try {
            const { title, description, status, priority, dueDate, assigneeId, isImportant, myDayDate, parentTaskId, listId, tags, reminderAt, recurrence } = req.body;
            if (!title) throw { name: 'BadRequest', message: 'title wajib diisi' };

            // Sub-tasks inherit the parent's companyId server-side — never trust
            // a client-supplied companyId for them.
            let resolvedCompanyId = companyId(req) ?? req.user.companyId;
            if (parentTaskId) {
                const parent = await Task.findOne({ where: { id: parentTaskId, ...companyFilter(req) } });
                if (!parent) throw { name: 'NotFound', message: 'Parent task tidak ditemukan' };
                resolvedCompanyId = parent.companyId;
            }

            const isAssignedToOther = assigneeId && Number(assigneeId) !== req.user.id;

            const task = await Task.create({
                title,
                description: description || null,
                status: status || 'TODO',
                priority: priority || 'MEDIUM',
                dueDate: dueDate || null,
                assigneeId: assigneeId || null,
                createdBy: req.user.id,
                companyId: resolvedCompanyId,
                isImportant: !!isImportant,
                myDayDate: myDayDate || null,
                parentTaskId: parentTaskId || null,
                assignmentStatus: isAssignedToOther ? 'PENDING' : null,
                listId: listId || null,
                tags: Array.isArray(tags) ? tags : [],
                reminderAt: reminderAt || null,
                recurrence: recurrence || 'NONE',
            });

            if (isAssignedToOther) {
                await notify(assigneeId, {
                    type: 'TASK_ASSIGNED',
                    title: 'Task baru ditugaskan',
                    message: `${req.user.name} menugaskan task "${title}" kepada Anda`,
                    link: `/tasks?open=${task.id}`,
                    companyId: task.companyId,
                });
            }

            const full = await Task.findByPk(task.id, { include: TASK_INCLUDE });
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

            const { title, description, status, priority, dueDate, assigneeId, isImportant, myDayDate, parentTaskId, listId, tags, reminderAt, recurrence } = req.body;
            const prevAssigneeId = task.assigneeId;
            const isReassignedToOther = assigneeId !== undefined && Number(assigneeId) !== prevAssigneeId && assigneeId && Number(assigneeId) !== req.user.id;
            const isCompletingNow = status === 'DONE' && task.status !== 'DONE';

            await task.update({
                title: title ?? task.title,
                description: description ?? task.description,
                status: status ?? task.status,
                priority: priority ?? task.priority,
                dueDate: dueDate === undefined ? task.dueDate : dueDate,
                assigneeId: assigneeId === undefined ? task.assigneeId : (assigneeId || null),
                isImportant: isImportant === undefined ? task.isImportant : !!isImportant,
                myDayDate: myDayDate === undefined ? task.myDayDate : myDayDate,
                parentTaskId: parentTaskId === undefined ? task.parentTaskId : (parentTaskId || null),
                assignmentStatus: isReassignedToOther ? 'PENDING' : task.assignmentStatus,
                assignmentNote: isReassignedToOther ? null : task.assignmentNote,
                listId: listId === undefined ? task.listId : (listId || null),
                tags: tags === undefined ? task.tags : (Array.isArray(tags) ? tags : []),
                reminderAt: reminderAt === undefined ? task.reminderAt : (reminderAt || null),
                recurrence: recurrence === undefined ? task.recurrence : (recurrence || 'NONE'),
            });

            if (isReassignedToOther) {
                await notify(assigneeId, {
                    type: 'TASK_ASSIGNED',
                    title: 'Task ditugaskan kepada Anda',
                    message: `${req.user.name} menugaskan task "${task.title}" kepada Anda`,
                    link: `/tasks?open=${task.id}`,
                    companyId: task.companyId,
                });
            }

            // Completing a recurring task spawns its next occurrence immediately
            // (mirrors MS To Do: the repeating task "reappears" the moment you
            // check it off, not on a schedule) — reuses this same TODO-status
            // creation path, just skipping notification (not a delegation).
            if (isCompletingNow && task.recurrence !== 'NONE' && task.dueDate) {
                await Task.create({
                    title: task.title,
                    description: task.description,
                    status: 'TODO',
                    priority: task.priority,
                    dueDate: nextDueDate(task.dueDate, task.recurrence),
                    assigneeId: task.assigneeId,
                    createdBy: task.createdBy,
                    companyId: task.companyId,
                    listId: task.listId,
                    tags: task.tags,
                    recurrence: task.recurrence,
                    parentTaskId: task.parentTaskId,
                });
            }

            const full = await Task.findByPk(task.id, {
                include: TASK_INCLUDE,
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

    static async accept(req, res, next) {
        try {
            const task = await Task.findOne({ where: { id: req.params.id, ...companyFilter(req) } });
            if (!task) throw { name: 'NotFound', message: 'Task tidak ditemukan' };
            if (task.assigneeId !== req.user.id) {
                throw { name: 'Forbidden', message: 'Hanya assignee yang bisa menerima task ini' };
            }
            if (task.assignmentStatus !== 'PENDING') {
                throw { name: 'BadRequest', message: 'Task ini sudah direspon' };
            }

            await task.update({ assignmentStatus: 'ACCEPTED', assignmentNote: null });

            await notify(task.createdBy, {
                type: 'TASK_ACCEPTED',
                title: 'Task diterima',
                message: `${req.user.name} menerima task "${task.title}"`,
                link: `/tasks?open=${task.id}`,
                companyId: task.companyId,
            });

            const full = await Task.findByPk(task.id, { include: TASK_INCLUDE });
            res.json(full);
        } catch (err) { next(err); }
    }

    static async reject(req, res, next) {
        try {
            const { note } = req.body;
            if (!note || !note.trim()) throw { name: 'BadRequest', message: 'Catatan penolakan wajib diisi' };

            const task = await Task.findOne({ where: { id: req.params.id, ...companyFilter(req) } });
            if (!task) throw { name: 'NotFound', message: 'Task tidak ditemukan' };
            if (task.assigneeId !== req.user.id) {
                throw { name: 'Forbidden', message: 'Hanya assignee yang bisa menolak task ini' };
            }
            if (task.assignmentStatus !== 'PENDING') {
                throw { name: 'BadRequest', message: 'Task ini sudah direspon' };
            }

            await task.update({ assignmentStatus: 'REJECTED', assignmentNote: note.trim() });

            await notify(task.createdBy, {
                type: 'TASK_REJECTED',
                title: 'Task ditolak',
                message: `${req.user.name} menolak task "${task.title}": ${note.trim()}`,
                link: `/tasks?open=${task.id}`,
                companyId: task.companyId,
            });

            const full = await Task.findByPk(task.id, { include: TASK_INCLUDE });
            res.json(full);
        } catch (err) { next(err); }
    }

    static async stats(req, res, next) {
        try {
            const { Op } = require('sequelize');
            const canViewAll = await userHasPermission(req, 'tasks.view');
            const ownFilter = canViewAll ? {} : {
                [Op.or]: [{ assigneeId: req.user.id }, { createdBy: req.user.id }],
            };
            const baseWhere = { ...companyFilter(req), ...ownFilter, parentTaskId: null };

            const today = new Date().toISOString().slice(0, 10);
            const weekAhead = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

            const [statusRows, priorityRows, overdue, dueSoon, total, done, pendingAssignments, listRows, taskLists] = await Promise.all([
                Task.count({ where: baseWhere, group: ['status'] }),
                Task.count({ where: baseWhere, group: ['priority'] }),
                Task.count({ where: { ...baseWhere, status: { [Op.ne]: 'DONE' }, dueDate: { [Op.lt]: today } } }),
                Task.count({ where: { ...baseWhere, status: { [Op.ne]: 'DONE' }, dueDate: { [Op.between]: [today, weekAhead] } } }),
                Task.count({ where: baseWhere }),
                Task.count({ where: { ...baseWhere, status: 'DONE' } }),
                Task.count({ where: { ...baseWhere, assignmentStatus: 'PENDING', assigneeId: req.user.id } }),
                Task.count({ where: baseWhere, group: ['listId'] }),
                TaskList.findAll({ where: { userId: req.user.id }, attributes: ['id', 'name', 'color'] }),
            ]);

            const toMap = (rows, key) => Object.fromEntries(rows.map(r => [r[key], r.count]));
            const byListCounts = toMap(listRows, 'listId');

            res.json({
                byStatus: { TODO: 0, IN_PROGRESS: 0, DONE: 0, ...toMap(statusRows, 'status') },
                byPriority: { LOW: 0, MEDIUM: 0, HIGH: 0, ...toMap(priorityRows, 'priority') },
                overdue,
                dueSoon,
                completionRate: total > 0 ? Math.round((done / total) * 100) : 0,
                pendingAssignments,
                total,
                byList: taskLists.map(l => ({ id: l.id, name: l.name, color: l.color, count: byListCounts[l.id] ?? 0 })),
            });
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
