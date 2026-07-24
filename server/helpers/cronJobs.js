'use strict';
const cron = require('node-cron');
const { Op } = require('sequelize');
const { Attendance, Shift, Task, TaskAssignee, Notification } = require('../models');
const { todayDateOnly, addDaysStr, weekdayOf } = require('./timezone');
const { backfillAbsentForDates } = require('./absentBackfill');

function setupCronJobs() {
    // Jam 00:00 WIB: siapa yang check-in kemarin tapi lupa check-out,
    // otomatis di-check-out-kan sesuai jam akhir shift-nya (bukan jam
    // sekarang), biar jam kerja yang tercatat tetap wajar.
    cron.schedule('0 0 * * *', autoCheckOutJob, { timezone: 'Asia/Jakarta' });

    // Jam 00:10 WIB (setelah auto check-out): siapa yang gak check-in sama
    // sekali kemarin, otomatis ditandai Absen — gak perlu admin klik tombol
    // manual lagi. Sabtu/Minggu di-skip, dan lintas semua company (system job,
    // bukan request-scoped) sekaligus.
    cron.schedule('10 0 * * *', autoMarkAbsentJob, { timezone: 'Asia/Jakarta' });

    // Tiap menit: task dengan reminderAt yang sudah lewat tapi belum
    // dinotifikasi (reminderSentAt IS NULL) — MS To Do-style "Remind me".
    cron.schedule('* * * * *', taskReminderJob, { timezone: 'Asia/Jakarta' });
}

async function autoCheckOutJob() {
    try {
        const yesterday = addDaysStr(todayDateOnly(), -1);
        const rows = await Attendance.findAll({
            where: { date: yesterday, checkInAt: { [Op.ne]: null }, checkOutAt: null },
            include: [{ model: Shift, as: 'shift', attributes: ['endTime'] }],
        });

        for (const row of rows) {
            if (!row.shift?.endTime) continue; // gak ada shift, gak bisa nentuin jam pulang
            const checkOutAt = new Date(`${row.date}T${row.shift.endTime}+07:00`);
            await row.update({
                checkOutAt,
                note: row.note || 'Check-out otomatis oleh sistem (lupa check-out, disesuaikan jam akhir shift)',
            });
        }
        if (rows.length) console.log(`[cron] auto check-out: ${rows.length} record disesuaikan untuk ${yesterday}`);
    } catch (err) {
        console.error('[cron] auto check-out gagal:', err.message);
    }
}

async function autoMarkAbsentJob() {
    try {
        const yesterday = addDaysStr(todayDateOnly(), -1);
        const wd = weekdayOf(yesterday);
        if (wd === 0 || wd === 6) return; // Sabtu/Minggu, gak dicek

        const result = await backfillAbsentForDates([yesterday], {}, null);
        if (result.created) console.log(`[cron] auto absen: ${result.created} record dibuat untuk ${yesterday}`);
    } catch (err) {
        console.error('[cron] auto absen gagal:', err.message);
    }
}

async function taskReminderJob() {
    try {
        const due = await Task.findAll({
            where: { reminderAt: { [Op.lte]: new Date() }, reminderSentAt: null },
        });

        for (const task of due) {
            const assignees = await TaskAssignee.findAll({ where: { taskId: task.id } });
            const recipientIds = assignees.length ? assignees.map(a => a.userId) : [task.createdBy];
            for (const recipientId of recipientIds) {
                await Notification.create({
                    userId: recipientId,
                    type: 'TASK_REMINDER',
                    title: 'Pengingat task',
                    message: `Pengingat untuk task "${task.title}"`,
                    link: `/tasks?open=${task.id}`,
                    companyId: task.companyId,
                });
            }
            await task.update({ reminderSentAt: new Date() });
        }
        if (due.length) console.log(`[cron] task reminder: ${due.length} notifikasi dikirim`);
    } catch (err) {
        console.error('[cron] task reminder gagal:', err.message);
    }
}

module.exports = { setupCronJobs };
