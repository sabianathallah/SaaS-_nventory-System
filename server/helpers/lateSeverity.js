'use strict';
const { partsInJakarta } = require('./timezone');

const GRACE_MINUTES = 15;
// Menit keterlambatan dihitung SETELAH grace period (di luar 15 menit toleransi).
const TIERS = [
    { key: 'RINGAN', label: 'Ringan', max: 15 },
    { key: 'SEDANG', label: 'Sedang', max: 45 },
    { key: 'BERAT',  label: 'Berat',  max: Infinity },
];

/**
 * Hitung tingkat keparahan telat dari selisih checkInAt vs shift.startTime.
 * Tidak menyimpan apapun ke DB — dihitung ulang setiap kali dibutuhkan.
 * Return null kalau data tidak cukup untuk dihitung (bukan LATE / tanpa shift).
 */
function lateSeverity(checkInAt, shiftStartTime) {
    if (!checkInAt || !shiftStartTime) return null;
    const { hour, minute } = partsInJakarta(new Date(checkInAt));
    const checkInMinutes = hour * 60 + minute;
    const [h, m] = shiftStartTime.split(':').map(Number);
    const shiftStartMinutes = h * 60 + m;
    const lateMinutes = checkInMinutes - shiftStartMinutes - GRACE_MINUTES;
    if (lateMinutes <= 0) return null;
    const tier = TIERS.find(t => lateMinutes <= t.max);
    return { key: tier.key, label: tier.label, lateMinutes };
}

module.exports = { lateSeverity, GRACE_MINUTES, TIERS };
