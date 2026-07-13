'use strict';
const { partsInJakarta } = require('./timezone');
const { DEFAULT_SCORES } = require('./hrisSettings');

// Skor kedisiplinan harian untuk leaderboard, berbasis jam datang relatif ke
// jam mulai shift (contoh shift 09:00). Semua nilai skor configurable per
// company via HRIS Settings (GUI Aturan Jam Kerja):
// - <= 09:00 (tepat waktu)                 -> scoreOnTime      (default 100)
// - 09:01 - 09:29                          -> scoreLateTier1   (default 90)
// - 09:30 - 09:45                          -> scoreLateTier2   (default 85)
// - 09:46 - 10:00                          -> scoreLateTier3   (default 80)
// - > 10:00                                -> scoreLateTier4   (default 75)
// - Izin telat APPROVED (status hadir)     -> scoreLateExcused (default 70)
// - HALF_DAY                               -> scoreHalfDay     (default 50)
// - FIELD masih PENDING_REVIEW             -> fieldPendingScore (default 75)
// - FIELD APPROVED + fieldScore terisi     -> pakai skor manual reviewer (absen di jalan)
// - FIELD APPROVED tanpa fieldScore        -> dianggap sudah di vendor, dihitung normal
// - FIELD REJECTED                         -> 0
// - ABSENT                                 -> 0
// - LEAVE / sakit-cuti                     -> tidak dihitung (hari netral, keluar dari pembagi)
//
// Catatan: tier dihitung dari jam check-in walau statusnya masih PRESENT
// (dalam grace period) — datang 09:10 tetap kena tier 1, bukan skor penuh.

// max = menit telat maksimal (inklusif) setelah jam mulai shift.
const ARRIVAL_TIERS = [
    { max: 0,        scoreKey: 'scoreOnTime' },
    { max: 29,       scoreKey: 'scoreLateTier1' },
    { max: 45,       scoreKey: 'scoreLateTier2' },
    { max: 60,       scoreKey: 'scoreLateTier3' },
    { max: Infinity, scoreKey: 'scoreLateTier4' },
];

// Skor dari selisih menit check-in vs jam mulai shift. Tanpa shift/jam
// check-in dianggap tepat waktu (tidak ada patokan untuk menghukum).
function arrivalScore(checkInAt, shiftStartTime, scores) {
    if (!checkInAt || !shiftStartTime) return scores.scoreOnTime;
    const { hour, minute } = partsInJakarta(new Date(checkInAt));
    const [h, m] = shiftStartTime.split(':').map(Number);
    const lateMinutes = (hour * 60 + minute) - (h * 60 + m);
    return scores[ARRIVAL_TIERS.find(t => lateMinutes <= t.max).scoreKey];
}

/**
 * Hitung skor satu record attendance. `att` butuh: status, workMode,
 * reviewStatus, fieldScore, lateExcuseStatus, checkInAt, shift.startTime.
 * `settings` dari getHrisSettings() — fallback ke default kalau tidak ada.
 * Return { counted: false } untuk hari netral, selain itu { score, counted: true }.
 */
function dailyScore(att, settings = {}) {
    const scores = { ...DEFAULT_SCORES, ...settings };

    if (att.status === 'LEAVE') return { counted: false };
    if (att.status === 'ABSENT') return { score: 0, counted: true };

    if (att.workMode === 'FIELD') {
        if (att.reviewStatus === 'REJECTED') return { score: 0, counted: true };
        if (att.reviewStatus === 'PENDING_REVIEW') return { score: scores.fieldPendingScore, counted: true };
        if (att.reviewStatus === 'APPROVED' && att.fieldScore != null) {
            return { score: att.fieldScore, counted: true };
        }
        // APPROVED tanpa adjust -> sudah di vendor saat absen, jatuh ke hitungan normal
    }

    if (att.lateExcuseStatus === 'APPROVED') return { score: scores.scoreLateExcused, counted: true };
    if (att.status === 'HALF_DAY') return { score: scores.scoreHalfDay, counted: true };

    return { score: arrivalScore(att.checkInAt, att.shift?.startTime, scores), counted: true };
}

module.exports = { dailyScore, arrivalScore, ARRIVAL_TIERS };
