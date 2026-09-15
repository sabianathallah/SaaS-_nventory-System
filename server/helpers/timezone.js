'use strict';

const TZ = 'Asia/Jakarta';

/** Today's date (YYYY-MM-DD) in Asia/Jakarta, regardless of server's own timezone. */
function todayDateOnly() {
    return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

/** Wall-clock date/time parts of a given moment (default now) in Asia/Jakarta. */
function partsInJakarta(date = new Date()) {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: TZ, hour12: false,
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
    }).formatToParts(date);
    const map = Object.fromEntries(parts.map(p => [p.type, p.value]));
    return {
        year: Number(map.year), month: Number(map.month), day: Number(map.day),
        hour: Number(map.hour) % 24, minute: Number(map.minute), second: Number(map.second),
    };
}

/** Current wall-clock date/time parts in Asia/Jakarta. */
function nowPartsInJakarta() {
    return partsInJakarta(new Date());
}

/** Tambah/kurangi hari dari string YYYY-MM-DD, aman dari pergeseran timezone lokal server. */
function addDaysStr(dateStr, delta) {
    const [y, m, d] = dateStr.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    dt.setUTCDate(dt.getUTCDate() + delta);
    return dt.toISOString().slice(0, 10);
}

/** Hari dalam minggu (0=Minggu..6=Sabtu) dari string YYYY-MM-DD. */
function weekdayOf(dateStr) {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** Tambah/kurangi bulan dari string YYYY-MM-DD — hari di-clamp ke tanggal
 *  terakhir bulan tujuan kalau tidak ada (mis. 31 Jan + 1 bulan -> 28/29 Feb,
 *  bukan meluber ke Maret). */
function addMonthsStr(dateStr, delta) {
    const [y, m, d] = dateStr.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1 + delta, 1));
    const lastDay = new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth() + 1, 0)).getUTCDate();
    dt.setUTCDate(Math.min(d, lastDay));
    return dt.toISOString().slice(0, 10);
}

module.exports = { TZ, todayDateOnly, nowPartsInJakarta, partsInJakarta, addDaysStr, weekdayOf, addMonthsStr };
