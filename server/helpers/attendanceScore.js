'use strict';
const { partsInJakarta } = require('./timezone');
const { ALL_DEFAULTS, DEFAULT_MIN_WORK_MINUTES } = require('./hrisSettings');

// Skor kedisiplinan harian untuk leaderboard. Dua komponen, keduanya
// configurable per company via HRIS Settings (GUI Aturan Jam Kerja):
//
// 1. Jam datang, relatif ke jam mulai shift (contoh shift 09:00):
//    - <= 09:00 (tepat waktu)              -> scoreOnTime      (default 100)
//    - telat <= lateTier1Max menit         -> scoreLateTier1   (default 90, <= 29 mnt)
//    - telat <= lateTier2Max menit         -> scoreLateTier2   (default 85, <= 45 mnt)
//    - telat <= lateTier3Max menit         -> scoreLateTier3   (default 80, <= 60 mnt)
//    - lebih dari itu                      -> scoreLateTier4   (default 75)
//
// 2. Lama jam kerja, relatif ke target durasi hari itu (jam shift kalau ada,
//    fallback minWorkMinutes — biar shift 4 jam tidak dinilai dengan target 8 jam):
//    - lebih >= workOvertimeMinMinutes     -> scoreWorkOvertime (default 100)
//    - durasi >= target                    -> scoreWorkFull    (default 100)
//    - kurang <= workShortTier1Max menit   -> scoreWorkTier1   (default 90)
//    - kurang <= workShortTier2Max menit   -> scoreWorkTier2   (default 80)
//    - kurang lebih dari itu               -> scoreWorkTier3   (default 70)
//
// Skor hari itu = campuran keduanya sesuai workDurationWeight (persen porsi
// durasi kerja). Bobot 0 (default) = murni jam datang, 100 = murni durasi
// kerja. Hari yang belum check-out dinilai dari jam datang saja.
//
// Kasus khusus:
// - Izin telat APPROVED (status hadir)     -> skor jam datang + lateExcuseBonus,
//                                             maks setinggi scoreOnTime — jam datang
//                                             tetap ngaruh, dan yang izin resmi selalu
//                                             lebih tinggi dari yang telat tanpa izin
// - autoCheckOut (lupa check-out)          -> komponen durasi dapat tier terendah.
//                                             Jam pulang sebenarnya tidak diketahui
//                                             (sistem cuma mengisi sampai jam akhir
//                                             shift), jadi tidak boleh dihitung penuh
//                                             — kalau tidak, diam-diam tidak check-out
//                                             jadi lebih untung daripada check-out
//                                             jujur lebih awal. Admin bisa memperbaiki
//                                             jam check-out-nya, dan itu mencabut penalti.
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

// Tier jam datang: max = menit telat maksimal (inklusif) setelah jam mulai shift.
function arrivalTiers(s) {
    return [
        { max: 0,              scoreKey: 'scoreOnTime' },
        { max: s.lateTier1Max, scoreKey: 'scoreLateTier1' },
        { max: s.lateTier2Max, scoreKey: 'scoreLateTier2' },
        { max: s.lateTier3Max, scoreKey: 'scoreLateTier3' },
        { max: Infinity,       scoreKey: 'scoreLateTier4' },
    ];
}

// Tier durasi kerja, diurut dari kurang paling sedikit. max = menit
// kekurangan maksimal (inklusif) dari target; negatif = kelebihan.
function workTiers(s) {
    return [
        { max: -s.workOvertimeMinMinutes, scoreKey: 'scoreWorkOvertime' },
        { max: 0,                         scoreKey: 'scoreWorkFull' },
        { max: s.workShortTier1Max,       scoreKey: 'scoreWorkTier1' },
        { max: s.workShortTier2Max,       scoreKey: 'scoreWorkTier2' },
        { max: Infinity,                  scoreKey: 'scoreWorkTier3' },
    ];
}

// "09:00" -> 540
function toMinutes(hhmm) {
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + m;
}

/**
 * Target durasi kerja hari itu. Pakai rentang jam shift kalau ada (shift 4
 * jam tidak adil kalau dinilai dengan target 8 jam), fallback ke setting
 * company. Shift yang melewati tengah malam dihitung +24 jam.
 */
function expectedWorkMinutes(att, scores) {
    const fallback = scores.minWorkMinutes ?? DEFAULT_MIN_WORK_MINUTES;
    const { startTime, endTime } = att.shift ?? {};
    if (!startTime || !endTime) return fallback;
    const span = toMinutes(endTime) - toMinutes(startTime);
    return span > 0 ? span : span + 24 * 60;
}

// Skor dari selisih menit check-in vs jam mulai shift. Tanpa shift/jam
// check-in dianggap tepat waktu (tidak ada patokan untuk menghukum).
function arrivalScore(checkInAt, shiftStartTime, scores) {
    if (!checkInAt || !shiftStartTime) return scores.scoreOnTime;
    const { hour, minute } = partsInJakarta(new Date(checkInAt));
    const lateMinutes = (hour * 60 + minute) - toMinutes(shiftStartTime);
    return scores[arrivalTiers(scores).find(t => lateMinutes <= t.max).scoreKey];
}

/**
 * Skor lama jam kerja satu hari, atau null kalau durasinya belum bisa
 * dihitung (belum check-out) — hari itu dinilai dari jam datang saja.
 */
function workDurationScore(att, scores) {
    if (!att.checkInAt || !att.checkOutAt) return null;
    // Jam pulang hasil auto check-out bukan jam pulang sebenarnya, jadi tidak
    // boleh dapat kredit durasi penuh.
    if (att.autoCheckOut) return scores.scoreWorkTier3;
    const workedMinutes = Math.floor((new Date(att.checkOutAt) - new Date(att.checkInAt)) / 60000);
    const shortMinutes = expectedWorkMinutes(att, scores) - workedMinutes;
    return scores[workTiers(scores).find(t => shortMinutes <= t.max).scoreKey];
}

// Campur skor jam datang dengan skor durasi kerja sesuai bobot company.
function blendWork(arrival, att, scores) {
    const weight = scores.workDurationWeight;
    if (!weight) return arrival;
    const work = workDurationScore(att, scores);
    if (work == null) return arrival;
    return Math.round((arrival * (100 - weight) + work * weight) / 100);
}

/**
 * Hitung skor satu record attendance. `att` butuh: status, workMode,
 * reviewStatus, fieldScore, lateExcuseStatus, checkInAt, checkOutAt,
 * autoCheckOut, shift.startTime, shift.endTime. `settings` dari
 * getHrisSettings() — fallback ke default kalau tidak ada.
 * Return { counted: false } untuk hari netral, selain itu { score, counted: true }.
 */
function dailyScore(att, settings = {}) {
    const scores = { ...ALL_DEFAULTS, ...settings };

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

    if (att.lateExcuseStatus === 'APPROVED') {
        const base = arrivalScore(att.checkInAt, att.shift?.startTime, scores);
        const excused = Math.min(base + scores.lateExcuseBonus, scores.scoreOnTime);
        return { score: blendWork(excused, att, scores), counted: true };
    }
    if (att.status === 'HALF_DAY') return { score: scores.scoreHalfDay, counted: true };

    const arrival = arrivalScore(att.checkInAt, att.shift?.startTime, scores);
    return { score: blendWork(arrival, att, scores), counted: true };
}

module.exports = {
    dailyScore, arrivalScore, workDurationScore, expectedWorkMinutes,
    arrivalTiers, workTiers,
};
