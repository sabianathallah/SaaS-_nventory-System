'use strict';
const { Task, TaskComment, TaskList, TaskAssignee, Notification, User, sequelize } = require('../models');
const { Op } = require('sequelize');
const { companyFilter, companyId } = require('../helpers/tenancy');
const { paginate, buildFilter, paginatedResponse } = require('../helpers/queryHelper');
const { userHasPermission } = require('../helpers/permCheck');
const { addDaysStr, weekdayOf } = require('../helpers/timezone');
const { canManageDivisi } = require('../helpers/divisiAccess');

const USER_ATTRS = ['id', 'name', 'email', 'divisi'];
const TASK_INCLUDE = [
    {
        model: User,
        as: 'assignees',
        attributes: USER_ATTRS,
        through: { attributes: ['assignmentStatus', 'assignmentNote'] },
    },
    { model: User, as: 'creator', attributes: USER_ATTRS },
    { model: TaskList, as: 'list', attributes: ['id', 'name', 'color', 'icon'] },
];

const SORT_MAP = {
    title:    [['title', 'ASC']],
    dueDate:  [['dueDate', 'ASC']],
    priority: [[sequelize.literal(`CASE "Task"."priority" WHEN 'HIGH' THEN 0 WHEN 'MEDIUM' THEN 1 ELSE 2 END`), 'ASC']],
    created:  [['createdAt', 'DESC']],
};

// A task no longer has a single `assigneeId` column — "is this task assigned
// to user X" is now an EXISTS check against the TaskAssignees join table.
// Interpolated as a literal (not a bind param) because Sequelize `where`
// fragments built this way can't easily thread through replacements; safe
// because callers always pass a Number()-coerced, NaN-checked id.
function assignedToUser(userId) {
    return sequelize.literal(`EXISTS (SELECT 1 FROM "TaskAssignees" WHERE "TaskAssignees"."taskId" = "Task"."id" AND "TaskAssignees"."userId" = ${Number(userId)})`);
}

function toIdArray(value) {
    if (value === undefined || value === null || value === '') return null;
    const arr = Array.isArray(value) ? value : String(value).split(',');
    const ids = arr.map(Number).filter(n => Number.isInteger(n));
    return ids.length ? ids : [];
}

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

// Replaces a task's assignee set with `userIds`, keeping existing per-user
// assignmentStatus/Note for anyone who stays assigned (so re-saving the same
// set doesn't reset an already-accepted assignment) and starting anyone new
// at PENDING (unless they're assigning themselves, which needs no response).
async function syncAssignees(task, userIds, actingUserId) {
    const existing = await TaskAssignee.findAll({ where: { taskId: task.id } });
    const existingByUser = new Map(existing.map(a => [a.userId, a]));
    const nextIds = new Set(userIds);

    const toRemove = existing.filter(a => !nextIds.has(a.userId));
    if (toRemove.length) await TaskAssignee.destroy({ where: { taskId: task.id, userId: toRemove.map(a => a.userId) } });

    const newlyAdded = [];
    for (const userId of nextIds) {
        if (existingByUser.has(userId)) continue;
        const isSelf = Number(userId) === Number(actingUserId);
        await TaskAssignee.create({
            taskId: task.id,
            userId,
            assignmentStatus: isSelf ? null : 'PENDING',
            assignmentNote: null,
        });
        if (!isSelf) newlyAdded.push(userId);
    }
    return newlyAdded;
}

class TaskController {
    static async list(req, res, next) {
        try {
            const { page, limit, offset } = paginate(req.query);
            const filter = buildFilter(req.query, { status: 'exact', priority: 'exact', listId: 'exact', divisi: 'exact' });

            // Collected separately (rather than spread alongside `filter`) because
            // several of these conditions share the Op.or/Op.and symbol keys —
            // spreading them into one object would silently drop all but the last.
            const andConditions = [];

            const assigneeIds = toIdArray(req.query.assigneeId);
            if (assigneeIds && assigneeIds.length) {
                andConditions.push({ [Op.or]: assigneeIds.map(assignedToUser) });
            }

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
                andConditions.push(assignedToUser(req.user.id));
            } else if (view === 'created') {
                viewFilter = { createdBy: req.user.id };
            } else if (view === 'completed') {
                viewFilter = { status: 'DONE' };
            }
            // 'all' (or unrecognized) leaves viewFilter empty — scope decided below.

            // `mine=true` scopes strictly to the current user (assigned to them OR
            // created by them) regardless of tasks.view — used by personal widgets
            // like the Dashboard's My Day/Completed history, which must never leak
            // company-wide data to an admin just because they hold that permission.
            if (req.query.mine === 'true' || !canViewAll) {
                andConditions.push({ [Op.or]: [assignedToUser(req.user.id), { createdBy: req.user.id }] });
            }

            // Top-level views only ever show parent tasks — sub-tasks are fetched
            // explicitly via ?parentTaskId=<id> (mirrors the listComments pattern
            // rather than a dedicated route) from the detail panel's Sub-tasks tab.
            const parentFilter = req.query.parentTaskId
                ? { parentTaskId: req.query.parentTaskId }
                : { parentTaskId: null };

            const { rows, count } = await Task.findAndCountAll({
                where: {
                    ...companyFilter(req), ...filter, ...viewFilter, ...parentFilter,
                    ...(andConditions.length ? { [Op.and]: andConditions } : {}),
                },
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
            const { title, description, status, priority, dueDate, assigneeIds, isImportant, myDayDate, parentTaskId, listId, tags, reminderAt, recurrence, divisi } = req.body;
            if (!title) throw { name: 'BadRequest', message: 'title wajib diisi' };

            // Sub-tasks inherit the parent's companyId server-side — never trust
            // a client-supplied companyId for them.
            let resolvedCompanyId = companyId(req) ?? req.user.companyId;
            if (parentTaskId) {
                const parent = await Task.findOne({ where: { id: parentTaskId, ...companyFilter(req) } });
                if (!parent) throw { name: 'NotFound', message: 'Parent task tidak ditemukan' };
                resolvedCompanyId = parent.companyId;
            }

            // A task belongs to its creator's divisi by default. Creating it
            // from inside a specific folder can target that folder instead —
            // but only if the caller is actually allowed to post there.
            const resolvedDivisi = (divisi && await canManageDivisi(req, divisi)) ? divisi : (req.user.divisi || null);

            const ids = (toIdArray(assigneeIds) || []).filter((v, i, a) => a.indexOf(v) === i);

            // Daily/weekday recurring tasks are meant to be worked on every day
            // they're active, so they default straight into My Day instead of
            // requiring the assignee to manually drag them there each morning.
            // Weekly recurrences are left alone — not a daily concern.
            const rec = recurrence || 'NONE';
            const defaultMyDayDate = (rec === 'DAILY' || rec === 'WEEKDAYS') ? (dueDate || null) : null;

            const task = await Task.create({
                title,
                description: description || null,
                status: status || 'TODO',
                priority: priority || 'MEDIUM',
                dueDate: dueDate || null,
                createdBy: req.user.id,
                companyId: resolvedCompanyId,
                divisi: resolvedDivisi,
                isImportant: !!isImportant,
                myDayDate: myDayDate !== undefined && myDayDate !== null && myDayDate !== '' ? myDayDate : defaultMyDayDate,
                parentTaskId: parentTaskId || null,
                listId: listId || null,
                tags: Array.isArray(tags) ? tags : [],
                reminderAt: reminderAt || null,
                recurrence: rec,
            });

            const notifiedIds = await syncAssignees(task, ids, req.user.id);
            for (const userId of notifiedIds) {
                await notify(userId, {
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

            const currentAssigneeLinks = await TaskAssignee.findAll({ where: { taskId: task.id } });
            const isCurrentAssignee = currentAssigneeLinks.some(a => a.userId === req.user.id);
            if (!canEditAll && task.createdBy !== req.user.id && !isCurrentAssignee) {
                throw { name: 'Forbidden', message: 'Anda tidak punya akses untuk mengubah task ini' };
            }

            const { title, description, status, priority, dueDate, assigneeIds, isImportant, myDayDate, parentTaskId, listId, tags, reminderAt, recurrence } = req.body;
            const isCompletingNow = status === 'DONE' && task.status !== 'DONE';
            // Reopening a previously-done task (e.g. undo from the Dashboard
            // checklist) clears completedAt so it drops back out of the
            // week/month completed history until it's checked off again.
            const isReopeningNow  = status !== undefined && status !== 'DONE' && task.status === 'DONE';

            // Can't finish a task while any of its sub-tasks are still open —
            // mirrors how MS To Do/San-Group treat steps as a completion gate.
            if (isCompletingNow) {
                const openSubtasks = await Task.count({
                    where: { parentTaskId: task.id, status: { [Op.ne]: 'DONE' } },
                });
                if (openSubtasks > 0) {
                    throw { name: 'BadRequest', message: `Selesaikan dulu ${openSubtasks} sub-task yang belum beres sebelum menutup task ini` };
                }
            }

            await task.update({
                title: title ?? task.title,
                description: description ?? task.description,
                status: status ?? task.status,
                priority: priority ?? task.priority,
                dueDate: dueDate === undefined ? task.dueDate : dueDate,
                isImportant: isImportant === undefined ? task.isImportant : !!isImportant,
                myDayDate: myDayDate === undefined ? task.myDayDate : myDayDate,
                parentTaskId: parentTaskId === undefined ? task.parentTaskId : (parentTaskId || null),
                listId: listId === undefined ? task.listId : (listId || null),
                tags: tags === undefined ? task.tags : (Array.isArray(tags) ? tags : []),
                reminderAt: reminderAt === undefined ? task.reminderAt : (reminderAt || null),
                recurrence: recurrence === undefined ? task.recurrence : (recurrence || 'NONE'),
                completedAt: isCompletingNow ? new Date() : (isReopeningNow ? null : task.completedAt),
            });

            if (assigneeIds !== undefined) {
                const ids = (toIdArray(assigneeIds) || []).filter((v, i, a) => a.indexOf(v) === i);
                const notifiedIds = await syncAssignees(task, ids, req.user.id);
                for (const userId of notifiedIds) {
                    await notify(userId, {
                        type: 'TASK_ASSIGNED',
                        title: 'Task ditugaskan kepada Anda',
                        message: `${req.user.name} menugaskan task "${task.title}" kepada Anda`,
                        link: `/tasks?open=${task.id}`,
                        companyId: task.companyId,
                    });
                }
            }

            // Completing a recurring task spawns its next occurrence immediately
            // (mirrors MS To Do: the repeating task "reappears" the moment you
            // check it off, not on a schedule) — reuses this same TODO-status
            // creation path, just skipping notification (not a delegation).
            if (isCompletingNow && task.recurrence !== 'NONE' && task.dueDate) {
                const nextDue = nextDueDate(task.dueDate, task.recurrence);
                const nextTask = await Task.create({
                    title: task.title,
                    description: task.description,
                    status: 'TODO',
                    priority: task.priority,
                    dueDate: nextDue,
                    myDayDate: (task.recurrence === 'DAILY' || task.recurrence === 'WEEKDAYS') ? nextDue : null,
                    createdBy: task.createdBy,
                    companyId: task.companyId,
                    divisi: task.divisi,
                    listId: task.listId,
                    tags: task.tags,
                    recurrence: task.recurrence,
                    parentTaskId: task.parentTaskId,
                });
                // Carry the assignment forward as-is (same commitment, not a new
                // delegation) — an assignee who already ACCEPTED stays ACCEPTED
                // without re-confirming every single occurrence, and no
                // "task assigned to you" notification is sent for it.
                if (currentAssigneeLinks.length) {
                    await TaskAssignee.bulkCreate(currentAssigneeLinks.map(a => ({
                        taskId: nextTask.id,
                        userId: a.userId,
                        assignmentStatus: a.assignmentStatus,
                        assignmentNote: a.assignmentNote,
                    })));
                }
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

            const link = await TaskAssignee.findOne({ where: { taskId: task.id, userId: req.user.id } });
            if (!link) throw { name: 'Forbidden', message: 'Hanya assignee yang bisa menerima task ini' };
            if (link.assignmentStatus !== 'PENDING') throw { name: 'BadRequest', message: 'Task ini sudah direspon' };

            await link.update({ assignmentStatus: 'ACCEPTED', assignmentNote: null });

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

            const link = await TaskAssignee.findOne({ where: { taskId: task.id, userId: req.user.id } });
            if (!link) throw { name: 'Forbidden', message: 'Hanya assignee yang bisa menolak task ini' };
            if (link.assignmentStatus !== 'PENDING') throw { name: 'BadRequest', message: 'Task ini sudah direspon' };

            await link.update({ assignmentStatus: 'REJECTED', assignmentNote: note.trim() });

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
            const canViewAll = await userHasPermission(req, 'tasks.view');
            const ownFilter = canViewAll ? {} : {
                [Op.or]: [assignedToUser(req.user.id), { createdBy: req.user.id }],
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
                TaskAssignee.count({ where: { userId: req.user.id, assignmentStatus: 'PENDING' } }),
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

    // Folder grid on the Tasks landing page — one tile per divisi that exists
    // among the company's users, with a task count scoped by the same
    // visibility rules as list()/stats() (admins/tasks.view see everything,
    // everyone else only their own created/assigned tasks).
    static async listDivisions(req, res, next) {
        try {
            const divisiRows = await User.findAll({
                where: { ...companyFilter(req), divisi: { [Op.ne]: null } },
                attributes: [[sequelize.fn('DISTINCT', sequelize.col('divisi')), 'divisi']],
                raw: true,
            });
            const divisions = divisiRows.map(r => r.divisi).filter(d => d && d.trim()).sort((a, b) => a.localeCompare(b));

            const canViewAll = await userHasPermission(req, 'tasks.view');
            const ownFilter = canViewAll ? {} : {
                [Op.or]: [assignedToUser(req.user.id), { createdBy: req.user.id }],
            };
            const baseWhere = { ...companyFilter(req), ...ownFilter, parentTaskId: null };

            const result = await Promise.all(divisions.map(async (divisi) => {
                const [taskCount, openCount] = await Promise.all([
                    Task.count({ where: { ...baseWhere, divisi } }),
                    Task.count({ where: { ...baseWhere, divisi, status: { [Op.ne]: 'DONE' } } }),
                ]);
                return { divisi, taskCount, openCount };
            }));

            res.json(result);
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

            const assigneeLinks = await TaskAssignee.findAll({ where: { taskId: task.id } });
            const recipients = new Set([...assigneeLinks.map(a => a.userId), task.createdBy].filter(Boolean));
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
