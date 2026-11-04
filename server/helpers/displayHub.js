'use strict';
// Relay layar pelanggan antar perangkat (laptop kasir -> iPad / tablet lain).
// Disimpan di memori server: isinya hanya keadaan keranjang terakhir, bukan data transaksi.
// Kasir mengirim keadaan (PUT), layar pelanggan menunggu perubahan lewat long-poll (GET ?since=versi).
// Server restart = sesi hilang; kasir otomatis mendaftarkan ulang kodenya di kiriman berikutnya.

const WAIT_MS = 25_000;              // long-poll ditahan paling lama segini lalu dijawab "tidak berubah"
const IDLE_TTL_MS = 24 * 3600_000;   // sesi tanpa aktivitas sehari dibuang
const VIEWER_FRESH_MS = 40_000;      // layar dianggap masih tersambung kalau polling dalam rentang ini

const sessions = new Map(); // code -> session

const now = () => Date.now();
const newCode = () => {
  for (let i = 0; i < 50; i++) {
    const c = String(1000 + Math.floor(Math.random() * 9000));
    if (!sessions.has(c)) return c;
  }
  throw new Error('Kode layar penuh, coba lagi');
};

function sweep() {
  const t = now();
  for (const [code, s] of sessions) if (t - s.touchedAt > IDLE_TTL_MS && !s.waiters.size) sessions.delete(code);
}
setInterval(sweep, 3600_000).unref?.();

function create(code, user, companyId, eventId) {
  const s = {
    code, companyId, eventId: String(eventId), ownerId: user.id, ownerName: user.name || '',
    version: 0, state: { phase: 'idle' }, qris: null, qrisVersion: 0,
    touchedAt: now(), viewers: new Map(), waiters: new Set(),
  };
  sessions.set(code, s);
  return s;
}

// Kasir minta kode. Kode lama dipakai lagi kalau masih miliknya (atau sudah hilang karena restart & belum dipakai orang).
function pair(user, companyId, eventId, wantCode) {
  const want = wantCode && /^\d{4}$/.test(String(wantCode)) ? String(wantCode) : null;
  if (want) {
    const s = sessions.get(want);
    if (!s) return create(want, user, companyId, eventId);
    if (s.ownerId === user.id) { s.eventId = String(eventId); s.companyId = companyId; s.touchedAt = now(); return s; }
  }
  return create(newCode(), user, companyId, eventId);
}

function viewerCount(s) {
  const t = now();
  let n = 0;
  for (const [id, at] of s.viewers) { if (t - at < VIEWER_FRESH_MS) n++; else s.viewers.delete(id); }
  return n;
}

// Kasir mengirim keadaan terbaru. null = kode bukan milik user ini.
function publish(user, companyId, code, eventId, state, qris) {
  let s = sessions.get(code);
  if (!s) s = create(code, user, companyId, eventId);       // server sempat restart
  if (s.ownerId !== user.id) return null;
  s.eventId = String(eventId || s.eventId);
  s.state = state || { phase: 'idle' };
  if (qris !== undefined && qris !== s.qris) { s.qris = qris || null; s.qrisVersion++; }
  s.version++;
  s.touchedAt = now();
  for (const w of s.waiters) w();
  return s;
}

function snapshot(s, qrisVersion) {
  return {
    code: s.code, eventId: s.eventId, cashierName: s.ownerName, version: s.version, state: s.state,
    qrisVersion: s.qrisVersion,
    ...(String(qrisVersion) !== String(s.qrisVersion) ? { qris: s.qris } : {}),
  };
}

// Layar pelanggan menunggu versi yang lebih baru dari `since`.
function wait(code, companyId, { since, qrisVersion, viewerId }, res) {
  const s = sessions.get(code);
  if (!s || (companyId && s.companyId && Number(s.companyId) !== Number(companyId))) return Promise.resolve(null);
  if (viewerId) s.viewers.set(String(viewerId).slice(0, 64), now());
  const ready = () => Number(since) < s.version || String(qrisVersion) !== String(s.qrisVersion) || since === undefined;
  if (ready()) return Promise.resolve(snapshot(s, qrisVersion));
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true; clearTimeout(timer); s.waiters.delete(finish);
      if (viewerId) s.viewers.set(String(viewerId).slice(0, 64), now());
      resolve(snapshot(s, qrisVersion));
    };
    const timer = setTimeout(finish, WAIT_MS);
    s.waiters.add(finish);
    // layar menutup koneksi sebelum dijawab (pindah halaman / internet putus): lepaskan penunggu
    res?.on?.('close', () => { if (!done && !res.writableEnded) { done = true; clearTimeout(timer); s.waiters.delete(finish); resolve(undefined); } });
  });
}

module.exports = { pair, publish, wait, viewerCount, _sessions: sessions };
