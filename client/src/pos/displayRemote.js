// Layar pelanggan di perangkat lain (iPad / tablet): keadaan kasir di-relay lewat server.
// Kasir: pairing -> dapat kode 4 digit -> setiap perubahan keranjang dikirim (yang terbaru saja, tidak antre).
// Layar: masukkan kode -> long-poll GET /pos/display/:code?since=versi.
// Butuh internet di kedua perangkat; kalau putus, kasir tetap jalan & layar menyusul begitu tersambung lagi.
import { posHttp } from './sync'
import { getItem, setItem } from './store'

const HEARTBEAT_MS = 20_000 // kirim ulang keadaan terakhir: pulih sendiri setelah server restart / internet balik

// ── sisi kasir ─────────────────────────────────────────────────────────────
let remote = null // { eventId, code, sentQris, last, inFlight, dirty, timer, onStatus, status }
const latest = new Map() // eventId -> keadaan kasir terakhir (dipakai saat baru dipasangkan)

const codeKey = (eventId) => `displayCode:${eventId}`

function setStatus(patch) {
  if (!remote) return
  remote.status = { ...remote.status, ...patch }
  remote.onStatus?.(remote.status)
}

// QRIS dikecilkan (maks 720 px) sebelum dikirim: foto/screenshot asli bisa beberapa MB
async function qrisImage() {
  const ds = await getItem('kv', 'displaySettings').catch(() => null)
  const src = ds?.qrisImage
  if (!src) return null
  try {
    const img = await new Promise((ok, fail) => { const i = new Image(); i.onload = () => ok(i); i.onerror = fail; i.src = src })
    const k = Math.min(1, 720 / Math.max(img.naturalWidth, img.naturalHeight))
    if (k === 1 && src.length < 600_000) return src
    const c = document.createElement('canvas')
    c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k)
    const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height)
    return c.toDataURL('image/png')
  } catch { return src.length < 2_500_000 ? src : null }
}

async function flush() {
  const r = remote
  if (!r || r.inFlight || !r.dirty) return
  r.inFlight = true; r.dirty = false
  try {
    const body = { eventId: r.eventId, state: r.last || { phase: 'idle' } }
    if (!r.sentQris) body.qris = await qrisImage()
    const { data } = await posHttp.put(`/pos/display/${r.code}`, body, { timeout: 10_000 })
    if ('qris' in body) r.sentQris = true
    setStatus({ online: true, viewers: data.viewers, error: null })
  } catch (e) {
    if (e.response?.status === 409) { // kode diambil kasir lain (jarang): minta kode baru
      await setItem('kv', codeKey(r.eventId), null)
      setStatus({ online: true, error: 'Kode berubah, masukkan kode baru di iPad' })
      await pairRemote(r.eventId, r.onStatus, { fresh: true })
      return
    }
    r.dirty = true // kirim lagi di kesempatan berikutnya
    setStatus({ online: false })
  } finally {
    r.inFlight = false
  }
  if (remote === r && r.dirty) flush()
}

// Aktifkan relay untuk event ini. Kode disimpan di laptop supaya iPad tidak perlu dipasangkan ulang.
export async function pairRemote(eventId, onStatus, { fresh = false } = {}) {
  const saved = fresh ? null : await getItem('kv', codeKey(eventId)).catch(() => null)
  const { data } = await posHttp.post('/pos/display/pair', { eventId, code: saved || undefined })
  await setItem('kv', codeKey(eventId), data.code)
  const last = latest.get(String(eventId)) || null
  stopRemote(false)
  remote = { eventId: String(eventId), code: data.code, sentQris: false, last, dirty: true, inFlight: false, onStatus, status: { code: data.code, online: true, viewers: data.viewers } }
  remote.timer = setInterval(() => { if (remote) { remote.dirty = true; flush() } }, HEARTBEAT_MS)
  onStatus?.(remote.status)
  flush()
  return data.code
}

// Sudah pernah dipasangkan di laptop ini? Lanjutkan otomatis saat kasir dibuka.
export async function resumeRemote(eventId, onStatus) {
  const saved = await getItem('kv', codeKey(eventId)).catch(() => null)
  if (!saved) return null
  try { return await pairRemote(eventId, onStatus) } catch { return null }
}

export function stopRemote(forget = true) {
  if (!remote) return
  clearInterval(remote.timer)
  if (forget) setItem('kv', codeKey(remote.eventId), null)
  remote.onStatus?.(null)
  remote = null
}

export function remoteStatus() { return remote?.status || null }

// dipanggil dari publishDisplay setiap keadaan kasir berubah
export function pushRemote(eventId, state) {
  latest.set(String(eventId), state)
  if (!remote || remote.eventId !== String(eventId)) return
  remote.last = state; remote.dirty = true
  flush()
}

// QRIS diganti di pengaturan -> kirim ulang ke iPad
export function resendQris() { if (remote) { remote.sentQris = false; remote.dirty = true; flush() } }

// ── sisi layar pelanggan ───────────────────────────────────────────────────
// cb({ state, eventId, cashierName, qris? }), onConn({ online, error })
export function watchRemote(code, { onState, onQris, onConn }) {
  let stopped = false, since, qv = '', ctrl = null, connected = false
  const viewer = Math.random().toString(36).slice(2, 10)
  const loop = async () => {
    while (!stopped) {
      ctrl = new AbortController()
      try {
        const { data } = await posHttp.get(`/pos/display/${code}`, {
          params: { ...(since !== undefined ? { since } : {}), qv, viewer }, timeout: 35_000, signal: ctrl.signal,
        })
        connected = true
        onConn?.({ online: true, error: null })
        if ('qris' in data) { qv = String(data.qrisVersion); onQris?.(data.qris) }
        if (since === undefined || data.version !== since) onState?.(data)
        since = data.version
      } catch (e) {
        if (stopped) return
        // 404 setelah pernah tersambung = server baru restart: tunggu kasir mendaftarkan ulang kodenya (heartbeat 20 dtk)
        if (e.response?.status === 404 && !connected) { onConn?.({ online: true, error: 'notfound' }); return }
        if (e.response?.status === 404) { since = undefined; qv = '' }
        if (e.response?.status === 401) { onConn?.({ online: true, error: 'session' }); return }
        if (e.response?.status === 403) { onConn?.({ online: true, error: 'auth' }); return }
        onConn?.({ online: false, error: null })
        await new Promise(r => setTimeout(r, e.response?.status === 404 ? 3000 : 2000))
      }
    }
  }
  loop()
  return () => { stopped = true; ctrl?.abort() }
}
