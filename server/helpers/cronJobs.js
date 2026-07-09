'use strict';
const cron = require('node-cron');
const { Op } = require('sequelize');
const { Attendance, Shift } = require('../models');
const { todayDateOnly, addDaysStr } = require('./timezone');

function setupCronJobs() {
    // Jam 00:00 WIB: siapa yang check-in kemarin tapi lupa check-out,
    // otomatis di-check-out-kan sesuai jam akhir shift-nya (bukan jam
    // sekarang), biar jam kerja yang tercatat tetap wajar.
    cron.schedule('0 0 * * *', autoCheckOutJob, { timezone: 'Asia/Jakarta' });
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

module.exports = { setupCronJobs };
