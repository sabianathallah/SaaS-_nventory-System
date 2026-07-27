'use strict';
const { Task, TaskComment, TaskAttachment, TaskList, TaskAssignee, Notification, User, sequelize } = require('../models');
const { Op } = require('sequelize');
const { companyFilter, companyId } = require('../helpers/tenancy');
const { paginate, buildFilter, paginatedResponse } = require('../helpers/queryHelper');
const { userHasPermission } = require('../helpers/permCheck');
const { addDaysStr, addMonthsStr } = require('../helpers/timezone');
const { canManageDivisi } = require('../helpers/divisiAccess');
const { destroyUpload } = require('../helpers/cloudinary');

const USER_ATTRS = ['id', 'name', 'email', 'divisi'];
// Standing folder for tasks that apply to everyone (mandatory surveys,
// company-wide announcements) rather than one division — see listDivisions().
const GENERAL_DIVISI = 'Umum';
// Standing folders that always show up in the Tasks landing grid regardless
// of whether any user's divisi(s) already reference them — lets an admin
// open/organize the folder before assigning anyone to that division.
const STANDING_DIVISIONS = [GENERAL_DIVISI, 'HR'];
const TASK_INCLUDE = [
    {
        model: User,
        as: 'assignees',
        attributes: USER_ATTRS,
        through: { attributes: ['assignmentStatus', 'assignmentNote'] },
    },
    { model: User, as: 'creator', attributes: USER_ATTRS },
    { model: TaskList, as: 'list', attributes: ['id', 'name', 'color', 'icon'] },
    { model: TaskAttachment, as: 'attachments', include: [{ model: User, as: 'user', attributes: USER_ATTRS }] },
    // Only ever populated for sub-tasks — lets flat listings (like My Day,
    // which surfaces sub-tasks alongside top-level ones) show "Sub-task dari: …".
    { model: Task, as: 'parentTask', attributes: ['id', 'title'] },
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

function isWeekend(dateStr) {
    const day = new Date(`${dateStr}T00:00:00`).getDay(); // 0 = Sunday, 6 = Saturday
    return day === 0 || day === 6;
}

// Rolls a date forward off Sat/Sun onto the following Monday — only DAILY
// recurrence uses this (a "setiap hari" task means every workday, Sat/Sunday
// are off; WEEKLY/MONTHLY keep whatever day the user actually picked, which
// may deliberately be a weekend).
function skipWeekend(dateStr) {
    let d = dateStr;
    while (isWeekend(d)) d = addDaysStr(d, 1);
    return d;
}

// Recurrence presets are fixed (no custom RRULE) — advances dueDate by the
// rule's cadence.
function nextDueDate(dueDate, recurrence) {
    if (!dueDate) return null;
    if (recurrence === 'DAILY') return skipWeekend(addDaysStr(dueDate, 1));
    if (recurrence === 'WEEKLY') return addDaysStr(dueDate, 7);
    if (recurrence === 'MONTHLY') return addMonthsStr(dueDate, 1);
    return null;
}

async function notify(userId, { type, title, message, link, companyId: cid }) {
    if (!userId) return;
    await Notification.create({ userId, type, title, message, link: link || null, companyId: cid ?? null });
}

// A sub-task is usually created with no assignees of its own — it's just a
// checklist step under a task someone's already been assigned to, and the
// creator adding it never re-assigns each step individually. So edit access
// walks up the parentTask chain (works for arbitrarily deep sub-sub-tasks
// too) and grants access if the caller is creator/assignee of ANY ancestor,
// not just the exact row being edited.
async function hasTaskAccess(task, req, canEditAll) {
    if (canEditAll) return true;
    let current = task;
    while (current) {
        if (current.createdBy === req.user.id) return true;
        const assignee = await TaskAssignee.findOne({ where: { taskId: current.id, userId: req.user.id } });
        if (assignee) return true;
        if (!current.parentTaskId) return false;
        current = await Task.findOne({ where: { id: current.parentTaskId, ...companyFilter(req) } });
    }
    return false;
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

            // Fetching a specific task's sub-tasks (?parentTaskId=<id>, used by
            // SubtaskTree/the detail panel) is gated on access to that PARENT
            // task — not on whether the caller happens to be individually
            // assigned to each sub-task row. Otherwise an assignee who accepted
            // the parent task can't see sub-tasks the creator added without
            // also re-assigning them one by one, which defeats the point of
            // "assign the parent, break it into steps for that person".
            if (req.query.parentTaskId) {
                const parent = await Task.findOne({ where: { id: req.query.parentTaskId, ...companyFilter(req) } });
                if (!parent) throw { name: 'NotFound', message: 'Task tidak ditemukan' };
                if (!canViewAll) {
                    const isParentAssignee = await TaskAssignee.findOne({ where: { taskId: parent.id, userId: req.user.id } });
                    if (parent.createdBy !== req.user.id && !isParentAssignee) {
                        throw { name: 'Forbidden', message: 'Anda tidak punya akses ke sub-task ini' };
                    }
                }
            } else if (req.query.mine === 'true' || !canViewAll) {
                // `mine=true` scopes strictly to the current user (assigned to them
                // OR created by them) regardless of tasks.view — used by personal
                // widgets like the Dashboard's My Day/Completed history, which must
                // never leak company-wide data to an admin just because they hold
                // that permission.
                andConditions.push({ [Op.or]: [assignedToUser(req.user.id), { createdBy: req.user.id }] });
            }

            // Top-level views only ever show parent tasks — sub-tasks are fetched
            // explicitly via ?parentTaskId=<id> (mirrors the listComments pattern
            // rather than a dedicated route) from the detail panel's Sub-tasks tab.
            // My Day is the one exception: it's a flat "what's due today"
            // checklist, so a sub-task due today needs to surface there too
            // instead of staying hidden inside its parent's detail panel.
            const parentFilter = req.query.parentTaskId
                ? { parentTaskId: req.query.parentTaskId }
                : view === 'my_day'
                ? {}
                : { parentTaskId: null };

            // Once a new month starts, tasks completed in an earlier month are
            // "archived" out of the regular Board/List/Table/Calendar views —
            // otherwise DONE tasks pile up in those views forever. They're never
            // deleted or actually hidden: the dedicated Completed tab (and the
            // Home page's month/week-grouped Completed History) has no such
            // cutoff and still shows the full history, organized by month.
            const isArchiveExempt = view === 'completed' || !!req.query.parentTaskId || !!filter.status;
            if (!isArchiveExempt) {
                const startOfMonth = new Date();
                startOfMonth.setDate(1);
                const startOfMonthStr = startOfMonth.toISOString().slice(0, 10);
                andConditions.push({
                    [Op.or]: [
                        { status: { [Op.ne]: 'DONE' } },
                        { completedAt: { [Op.gte]: startOfMonthStr } },
                        { completedAt: null },
                    ],
                });
            }

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

            // A recurring task needs a real dueDate for the engine to compute
            // the next occurrence on completion (see nextDueDate()) — default
            // it to today rather than silently leaving the recurrence
            // non-functional whenever the due date picker is left blank. Daily
            // means every workday, so a Daily task created over the weekend
            // defaults to the coming Monday instead of Sat/Sun.
            const rec = recurrence || 'NONE';
            const todayStr = new Date().toISOString().slice(0, 10);
            const resolvedDueDate = dueDate || (rec === 'DAILY' ? skipWeekend(todayStr) : rec !== 'NONE' ? todayStr : null);

            // Daily recurring tasks are meant to be worked on every day they're
            // active, so they default straight into My Day instead of requiring
            // the assignee to manually drag them there each morning. Weekly/
            // monthly recurrences are left alone — not a daily concern.
            const defaultMyDayDate = rec === 'DAILY' ? resolvedDueDate : null;

            const task = await Task.create({
                title,
                description: description || null,
                status: status || 'TODO',
                priority: priority || 'MEDIUM',
                dueDate: resolvedDueDate,
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
            if (!(await hasTaskAccess(task, req, canEditAll))) {
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

            const resolvedRecurrence = recurrence === undefined ? task.recurrence : (recurrence || 'NONE');
            let resolvedDueDate = dueDate === undefined ? task.dueDate : dueDate;
            // Same reasoning as create(): switching a task to a recurrence
            // (e.g. via the "Ulangi" dropdown) needs a real dueDate for the
            // engine to compute the next occurrence — default to today rather
            // than leaving it silently non-functional. Daily skips straight to
            // Monday if today's a weekend, same as create().
            if (resolvedRecurrence !== 'NONE' && !resolvedDueDate) {
                const todayStr = new Date().toISOString().slice(0, 10);
                resolvedDueDate = resolvedRecurrence === 'DAILY' ? skipWeekend(todayStr) : todayStr;
            }
            // Turning a task Daily (or it already being Daily) means it should
            // show up in "Tugas Hari Ini" right away, mirroring the same
            // dueDate-as-myDayDate convention the recurrence spawner below
            // already uses — but never override an explicit myDayDate the
            // caller just sent (e.g. the Sun-icon toggle turning it off).
            const shouldDefaultMyDay = myDayDate === undefined && resolvedRecurrence === 'DAILY' && !task.myDayDate;
            const resolvedMyDayDate = myDayDate === undefined
                ? (shouldDefaultMyDay ? resolvedDueDate : task.myDayDate)
                : myDayDate;

            await task.update({
                title: title ?? task.title,
                description: description ?? task.description,
                status: status ?? task.status,
                priority: priority ?? task.priority,
                dueDate: resolvedDueDate,
                isImportant: isImportant === undefined ? task.isImportant : !!isImportant,
                myDayDate: resolvedMyDayDate,
                parentTaskId: parentTaskId === undefined ? task.parentTaskId : (parentTaskId || null),
                listId: listId === undefined ? task.listId : (listId || null),
                tags: tags === undefined ? task.tags : (Array.isArray(tags) ? tags : []),
                reminderAt: reminderAt === undefined ? task.reminderAt : (reminderAt || null),
                recurrence: resolvedRecurrence,
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

            // Checking off a sub-task means real work has actually started on
            // the parent — bump it out of TODO into IN_PROGRESS so the board
            // reflects that. One-way only (never auto-reverts if the sub-task
            // gets un-checked again) and never overrides IN_PROGRESS/DONE.
            if (isCompletingNow && task.parentTaskId) {
                const parent = await Task.findOne({ where: { id: task.parentTaskId, ...companyFilter(req) } });
                if (parent && parent.status === 'TODO') {
                    await parent.update({ status: 'IN_PROGRESS' });
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
                    myDayDate: task.recurrence === 'DAILY' ? nextDue : null,
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

                // Sub-tasks belong to the completed occurrence, not the new one —
                // clone them onto nextTask reset to TODO so the next occurrence
                // starts with the same checklist instead of an empty one.
                const oldSubTasks = await Task.findAll({
                    where: { parentTaskId: task.id },
                    include: [{ model: TaskAssignee, as: 'assigneeLinks' }],
                });
                for (const sub of oldSubTasks) {
                    const newSub = await Task.create({
                        title: sub.title,
                        description: sub.description,
                        status: 'TODO',
                        priority: sub.priority,
                        dueDate: null,
                        myDayDate: null,
                        createdBy: sub.createdBy,
                        companyId: sub.companyId,
                        divisi: sub.divisi,
                        listId: sub.listId,
                        tags: sub.tags,
                        recurrence: 'NONE',
                        parentTaskId: nextTask.id,
                    });
                    if (sub.assigneeLinks && sub.assigneeLinks.length) {
                        await TaskAssignee.bulkCreate(sub.assigneeLinks.map(a => ({
                            taskId: newSub.id,
                            userId: a.userId,
                            assignmentStatus: a.assignmentStatus,
                            assignmentNote: a.assignmentNote,
                        })));
                    }
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

    // Fetches one task with full associations — used both to open the detail
    // panel on a top-level task and to drill into a sub-task's own detail
    // (sub-tasks are just Tasks with a parentTaskId, so the same shape works).
    static async show(req, res, next) {
        try {
            const canViewAll = await userHasPermission(req, 'tasks.view');
            const task = await Task.findOne({
                where: { id: req.params.id, ...companyFilter(req) },
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
            });
            if (!task) throw { name: 'NotFound', message: 'Task tidak ditemukan' };

            if (!canViewAll) {
                const isAssignee = (task.assignees ?? []).some(a => a.id === req.user.id);
                if (task.createdBy !== req.user.id && !isAssignee) {
                    throw { name: 'Forbidden', message: 'Anda tidak punya akses ke task ini' };
                }
            }
            res.json(task);
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
            // Users can belong to more than one divisi now (divisis JSON array) —
            // flatten every element across all matching users, plus the legacy
            // single `divisi` column for any row not yet carrying an array value.
            const usersWithDivisi = await User.findAll({
                where: companyFilter(req),
                attributes: ['divisi', 'divisis'],
                raw: true,
            });
            const seen = new Set();
            for (const u of usersWithDivisi) {
                if (u.divisi) seen.add(u.divisi);
                for (const d of (Array.isArray(u.divisis) ? u.divisis : [])) seen.add(d);
            }
            const fromUsers = [...seen].filter(d => d && d.trim() && !STANDING_DIVISIONS.includes(d)).sort((a, b) => a.localeCompare(b));
            // Standing folders (Umum, HR) are always shown first, regardless of
            // whether any user's divisi(s) literally reference them.
            const divisions = [...STANDING_DIVISIONS, ...fromUsers];

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
                return { divisi, taskCount, openCount, general: divisi === GENERAL_DIVISI };
            }));

            res.json(result);
        } catch (err) { next(err); }
    }

    // Admin-only staff/divisi performance dashboard — gated at the route level
    // (rpAny('tasks.view','tasks.manage')), so unlike list()/stats() this never
    // narrows to "my own tasks"; it always reports across the whole company.
    static async analytics(req, res, next) {
        try {
            const { dateFrom, dateTo, divisi } = req.query;
            const cf = companyFilter(req);

            const conditions = ['t."parentTaskId" IS NULL'];
            const replacements = {};
            if (cf.companyId) { conditions.push('t."companyId" = :companyId'); replacements.companyId = cf.companyId; }
            if (dateFrom) { conditions.push('t."createdAt" >= :dateFrom'); replacements.dateFrom = dateFrom; }
            if (dateTo)   { conditions.push('t."createdAt" <= :dateTo');   replacements.dateTo = dateTo; }
            if (divisi)   { conditions.push('t."divisi" = :divisi'); replacements.divisi = divisi; }
            const where = conditions.join(' AND ');

            const byStaff = await sequelize.query(`
                SELECT
                    u.id                                                                     AS "userId",
                    u.name,
                    u.divisi,
                    COUNT(*) FILTER (WHERE t.status != 'DONE')::int                           AS active,
                    COUNT(*) FILTER (WHERE t.status = 'DONE')::int                            AS completed,
                    COUNT(*) FILTER (WHERE t.status != 'DONE' AND t."dueDate" < CURRENT_DATE)::int AS overdue,
                    COUNT(*) FILTER (WHERE ta."assignmentStatus" = 'REJECTED')::int            AS rejected,
                    ROUND(AVG(EXTRACT(EPOCH FROM (ta."updatedAt" - ta."createdAt")) / 3600)
                        FILTER (WHERE ta."assignmentStatus" IN ('ACCEPTED', 'REJECTED')))::int AS "avgResponseHours"
                FROM "TaskAssignees" ta
                JOIN "Tasks" t ON t.id = ta."taskId"
                JOIN "Users" u ON u.id = ta."userId"
                WHERE ${where}
                GROUP BY u.id, u.name, u.divisi
                ORDER BY completed DESC
            `, { replacements, type: sequelize.QueryTypes.SELECT });

            const byDivisiRaw = await sequelize.query(`
                SELECT
                    t.divisi,
                    COUNT(*)::int                                                             AS total,
                    COUNT(*) FILTER (WHERE t.status = 'DONE')::int                             AS completed,
                    COUNT(*) FILTER (WHERE t.status != 'DONE' AND t."dueDate" < CURRENT_DATE)::int AS overdue
                FROM "Tasks" t
                WHERE ${where} AND t.divisi IS NOT NULL
                GROUP BY t.divisi
                ORDER BY t.divisi ASC
            `, { replacements, type: sequelize.QueryTypes.SELECT });
            const byDivisi = byDivisiRaw.map(r => ({
                ...r,
                completionRate: r.total > 0 ? Math.round((r.completed / r.total) * 100) : 0,
            }));

            // Monthly completion trend runs on its own date axis (completedAt,
            // not createdAt) — defaults to the last 6 months when no explicit
            // range is given, independent of the byStaff/byDivisi filter above.
            const trendConditions = ['t."completedAt" IS NOT NULL', 't."parentTaskId" IS NULL'];
            const trendReplacements = {};
            if (cf.companyId) { trendConditions.push('t."companyId" = :companyId'); trendReplacements.companyId = cf.companyId; }
            if (divisi)   { trendConditions.push('t."divisi" = :divisi'); trendReplacements.divisi = divisi; }
            if (dateFrom) { trendConditions.push('t."completedAt" >= :trendFrom'); trendReplacements.trendFrom = dateFrom; }
            else          { trendConditions.push(`t."completedAt" >= (CURRENT_DATE - INTERVAL '6 months')`); }
            if (dateTo)   { trendConditions.push('t."completedAt" <= :trendTo'); trendReplacements.trendTo = dateTo; }

            const monthlyTrend = await sequelize.query(`
                SELECT TO_CHAR(t."completedAt", 'YYYY-MM') AS month, COUNT(*)::int AS completed
                FROM "Tasks" t
                WHERE ${trendConditions.join(' AND ')}
                GROUP BY month
                ORDER BY month ASC
            `, { replacements: trendReplacements, type: sequelize.QueryTypes.SELECT });

            res.json({ byStaff, byDivisi, monthlyTrend });
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

    // One endpoint for all three kinds of attachment: a real image file goes
    // through uploadSingle('image') (see routes/task.js) and lands in
    // req.file; a video/document is never uploaded directly (storage cost) —
    // the caller just pastes a link (YouTube/Drive/Docs/etc.) as `videoUrl`
    // or `documentUrl`.
    static async addAttachment(req, res, next) {
        try {
            const canEditAll = await userHasPermission(req, 'tasks.edit');
            const task = await Task.findOne({ where: { id: req.params.id, ...companyFilter(req) } });
            if (!task) throw { name: 'NotFound', message: 'Task tidak ditemukan' };

            if (!(await hasTaskAccess(task, req, canEditAll))) {
                throw { name: 'Forbidden', message: 'Anda tidak punya akses untuk menambah lampiran pada task ini' };
            }

            let attachment;
            if (req.file?.path) {
                attachment = await TaskAttachment.create({
                    taskId: task.id, userId: req.user.id, type: 'IMAGE', url: req.file.path,
                });
            } else if (req.body.videoUrl && /^https?:\/\//i.test(req.body.videoUrl.trim())) {
                attachment = await TaskAttachment.create({
                    taskId: task.id, userId: req.user.id, type: 'VIDEO_LINK', url: req.body.videoUrl.trim(),
                });
            } else if (req.body.documentUrl && /^https?:\/\//i.test(req.body.documentUrl.trim())) {
                attachment = await TaskAttachment.create({
                    taskId: task.id, userId: req.user.id, type: 'DOCUMENT', url: req.body.documentUrl.trim(),
                });
            } else {
                throw { name: 'BadRequest', message: 'Lampirkan foto, tautan video, atau tautan dokumen (http/https) yang valid' };
            }

            const full = await TaskAttachment.findByPk(attachment.id, {
                include: [{ model: User, as: 'user', attributes: USER_ATTRS }],
            });
            res.status(201).json(full);
        } catch (err) {
            if (req.file?.path) await destroyUpload(req.file.path);
            next(err);
        }
    }

    static async removeAttachment(req, res, next) {
        try {
            const canEditAll = await userHasPermission(req, 'tasks.edit');
            const task = await Task.findOne({ where: { id: req.params.id, ...companyFilter(req) } });
            if (!task) throw { name: 'NotFound', message: 'Task tidak ditemukan' };

            const attachment = await TaskAttachment.findOne({ where: { id: req.params.attachmentId, taskId: task.id } });
            if (!attachment) throw { name: 'NotFound', message: 'Lampiran tidak ditemukan' };
            if (!canEditAll && task.createdBy !== req.user.id && attachment.userId !== req.user.id) {
                throw { name: 'Forbidden', message: 'Anda tidak punya akses untuk menghapus lampiran ini' };
            }

            if (attachment.type === 'IMAGE') await destroyUpload(attachment.url);
            await attachment.destroy();
            res.json({ message: 'Lampiran dihapus' });
        } catch (err) { next(err); }
    }
}

module.exports = TaskController;
