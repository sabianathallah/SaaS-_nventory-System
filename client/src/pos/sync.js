import axios from 'axios'
import { allItems, delItem, getItem, setItem } from './store'

// Instance terpisah dari api/axios: kasir tidak boleh dilempar ke halaman login
// atau dibanjiri toast hanya karena internet putus-nyambung.
export const posHttp = axios.create({ baseURL: import.meta.env.VITE_API_URL || '/api', timeout: 15_000 })

// Token login berlaku 8 jam; event bisa lebih lama. Selama kasir / layar pelanggan terbuka,
// token diperpanjang otomatis sebelum habis supaya transaksi tetap terkirim.
const REFRESH_BEFORE_MS = 3 * 3600_000 // perpanjang kalau sisa < 3 jam
let refreshing = null
const tokenExp = (t) => { try { return JSON.parse(atob(t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).exp * 1000 } catch { return 0 } }
export function sessionExpired() {
  const t = localStorage.getItem('token')
  return !t || tokenExp(t) <= Date.now()
}
export async function ensureFreshToken() {
  const t = localStorage.getItem('token')
  if (!t) return
  const exp = tokenExp(t)
  if (!exp || exp <= Date.now() || exp - Date.now() > REFRESH_BEFORE_MS) return // sudah habis (harus login) / masih lama
  if (!refreshing) {
    refreshing = axios.post(`${import.meta.env.VITE_API_URL || '/api'}/refresh-token`, null, { headers: { Authorization: `Bearer ${t}` }, timeout: 15_000 })
      .then(({ data }) => { if (data?.access_token && localStorage.getItem('token') === t) localStorage.setItem('token', data.access_token) })
      .catch(() => { /* offline: dicoba lagi di permintaan berikutnya */ })
      .finally(() => { refreshing = null })
  }
  await refreshing
}

posHttp.interceptors.request.use(async (config) => {
  if (!config.url?.includes('refresh-token')) await ensureFreshToken()
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  try {
    const c = JSON.parse(localStorage.getItem('selectedCompany'))
    if (c?.id) config.params = { ...(config.params || {}), companyId: c.id }
  } catch { /* tanpa company scope */ }
  return config
})

const listeners = new Set()
export function onSyncChange(fn) { listeners.add(fn); return () => listeners.delete(fn) }
const emit = (state) => listeners.forEach(fn => fn(state))

let running = false
// Kirim antrean satu per satu (urut waktu jual). Berhenti di gangguan koneksi/server,
// lanjut ke transaksi berikutnya kalau server menolak data (ditandai error, tidak hilang).
export async function syncQueue() {
  if (running) return
  running = true
  let authError = false
  try {
    const queue = (await allItems('queue')).sort((a, b) => a.soldAt.localeCompare(b.soldAt))
    for (const order of queue) {
      try {
        const res = await posHttp.post('/pos/orders', order)
        await setItem('sent', order.clientOrderId, { ...order, server: res.data.order, sentAt: new Date().toISOString() })
        await delItem('queue', order.clientOrderId)
        await setItem('kv', 'lastSync', new Date().toISOString())
      } catch (err) {
        const status = err.response?.status
        if (status === 401) { authError = true; break }
        if (status >= 400 && status < 500) {
          await setItem('queue', order.clientOrderId, { ...order, error: err.response?.data?.message || `Ditolak server (${status})` })
          continue
        }
        break // offline / timeout / server 5xx: coba lagi nanti
      }
    }
  } finally {
    running = false
    emit(await syncState(authError))
  }
}

export async function syncState(authError = false) {
  const queue = await allItems('queue')
  return {
    pending: queue.length,
    failed: queue.filter(o => o.error).length,
    authError: authError || sessionExpired(),
    lastSync: (await getItem('kv', 'lastSync')) || null,
    online: navigator.onLine,
  }
}

export async function enqueueOrder(order) {
  await setItem('queue', order.clientOrderId, order)
  emit(await syncState())
  syncQueue()
}

// Coba kirim berkala + saat koneksi kembali.
let timer = null
export function startAutoSync() {
  if (timer) return () => {}
  const kick = () => syncQueue()
  window.addEventListener('online', kick)
  timer = setInterval(() => { ensureFreshToken(); kick() }, 20_000)
  kick()
  return () => { window.removeEventListener('online', kick); clearInterval(timer); timer = null }
}
