import axios from 'axios'
import { allItems, delItem, getItem, setItem } from './store'

// Instance terpisah dari api/axios: kasir tidak boleh dilempar ke halaman login
// atau dibanjiri toast hanya karena internet putus-nyambung.
export const posHttp = axios.create({ baseURL: import.meta.env.VITE_API_URL || '/api', timeout: 15_000 })
posHttp.interceptors.request.use((config) => {
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
    authError,
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
  timer = setInterval(kick, 20_000)
  kick()
  return () => { window.removeEventListener('online', kick); clearInterval(timer); timer = null }
}
