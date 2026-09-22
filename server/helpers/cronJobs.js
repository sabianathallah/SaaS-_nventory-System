'use strict';
const cron = require('node-cron');
const { Op } = require('sequelize');
const { Attendance, Shift, Task, TaskAssignee, Notification } = require('../models');
const { dailyScore } = require('./attendanceScore');
const { getHrisSettingsByCompany } = require('./hrisSettings');
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

    // Jam 00:30 WIB (setelah auto check-out & auto absen): bekukan skor
    // kedisiplinan harian kemarin. Skor yang sudah dibekukan dipakai apa adanya
    // oleh leaderboard, jadi mengubah kebijakan poin tidak lagi mengubah
    // ranking bulan-bulan yang sudah lewat.
    cron.schedule('30 0 * * *', snapshotScoresJob, { timezone: 'Asia/Jakarta' });

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
                // Ditandai supaya poin lama jam kerja tidak dihitung penuh —
                // jam pulang aslinya tidak diketahui. Kalau tidak, diam-diam
                // tidak check-out jadi lebih untung daripada check-out jujur
                // lebih awal. Admin yang memperbaiki jam check-out mencabut
                // tanda ini.
                autoCheckOut: true,
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

// Bekukan skor harian kemarin, satu kali per record. Settingnya diambil per
// company supaya tiap tenant dinilai dengan kebijakannya sendiri.
async function snapshotScoresJob(date) {
    try {
        const target = date ?? addDaysStr(todayDateOnly(), -1);
        const rows = await Attendance.findAll({
            where: { date: target, scoreSnapshotAt: null },
            include: [{ model: Shift, as: 'shift', attributes: ['startTime', 'endTime'] }],
        });
        if (!rows.length) return 0;

        const settingsCache = new Map();
        const settingsFor = async (cid) => {
            const key = cid ?? 'null';
            if (!settingsCache.has(key)) settingsCache.set(key, await getHrisSettingsByCompany(cid));
            return settingsCache.get(key);
        };

        const now = new Date();
        let saved = 0;
        for (const row of rows) {
            const daily = dailyScore(row, await settingsFor(row.companyId));
            await row.update({
                scoreSnapshot: daily.counted ? daily.score : null,
                scoreSnapshotAt: now,
            });
            saved += 1;
        }
        console.log(`[cron] snapshot skor: ${saved} record dibekukan untuk ${target}`);
        return saved;
    } catch (err) {
        console.error('[cron] snapshot skor gagal:', err.message);
        return 0;
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

module.exports = { setupCronJobs, snapshotScoresJob };
