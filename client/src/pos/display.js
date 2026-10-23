// Layar pelanggan: kasir mengirim keadaan transaksi ke jendela kedua di laptop yang sama
// (layar eksternal / iPad lewat Duet/Splashtop) lewat BroadcastChannel — tanpa server, jalan offline.
const CHANNEL = 'preface-pos-display'

let channel = null
let last = null
const ch = () => {
  if (!channel && 'BroadcastChannel' in window) {
    channel = new BroadcastChannel(CHANNEL)
    // jendela layar yang baru dibuka minta keadaan terakhir
    channel.onmessage = (e) => { if (e.data?.type === 'hello' && last) channel.postMessage(last) }
  }
  return channel
}

// dipanggil kasir setiap keranjang / layar bayar / hasil bayar berubah
export function publishDisplay(eventId, state) {
  last = { type: 'state', eventId: String(eventId), state, at: Date.now() }
  ch()?.postMessage(last)
}

// dipanggil halaman layar pelanggan
export function subscribeDisplay(eventId, cb) {
  const c = 'BroadcastChannel' in window ? new BroadcastChannel(CHANNEL) : null
  if (!c) return () => {}
  c.onmessage = (e) => { if (e.data?.type === 'state' && e.data.eventId === String(eventId)) cb(e.data.state) }
  c.postMessage({ type: 'hello' })
  return () => c.close()
}

// Buka jendela layar pelanggan; kalau ada layar kedua (Chrome, izin "window management"), langsung ditaruh di sana.
export async function openDisplayWindow(eventId) {
  const url = `/pos/display/${eventId}`
  let feat = 'popup,width=1180,height=820'
  try {
    if (window.screen.isExtended && 'getScreenDetails' in window) {
      const d = await window.getScreenDetails()
      const other = d.screens.find(s => s !== d.currentScreen)
      if (other) feat = `popup,left=${other.availLeft},top=${other.availTop},width=${other.availWidth},height=${other.availHeight}`
    }
  } catch { /* izin ditolak: buka biasa, geser manual */ }
  const w = window.open(url, 'preface-customer-display', feat)
  return !!w
}

// Deteksi layar dicolok / dicabut (Chrome & Edge). Tanpa dukungan: tidak pernah terpanggil.
export function onScreensChange(cb) {
  const s = window.screen
  if (!('isExtended' in s) || !s.addEventListener) return () => {}
  const h = () => cb(s.isExtended)
  s.addEventListener('change', h)
  return () => s.removeEventListener('change', h)
}
