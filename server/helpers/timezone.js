'use strict';

const TZ = 'Asia/Jakarta';

/** Today's date (YYYY-MM-DD) in Asia/Jakarta, regardless of server's own timezone. */
function todayDateOnly() {
    return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

/** Current wall-clock date/time parts in Asia/Jakarta. */
function nowPartsInJakarta() {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: TZ, hour12: false,
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
    }).formatToParts(new Date());
    const map = Object.fromEntries(parts.map(p => [p.type, p.value]));
    return {
        year: Number(map.year), month: Number(map.month), day: Number(map.day),
        hour: Number(map.hour) % 24, minute: Number(map.minute), second: Number(map.second),
    };
}

module.exports = { TZ, todayDateOnly, nowPartsInJakarta };
