// QRIS statis -> QRIS dengan nominal (dibuat di laptop kasir, offline, tanpa server).
//
// Isi QR QRIS = teks EMVCo MPM: deretan [ID 2 digit][panjang 2 digit][nilai].
// Yang diubah HANYA:
//   01 (point of initiation) "11" statis -> "12" dinamis
//   54 (nominal)             ditambahkan
//   55/56/57 (tip)           dibuang, supaya pembeli tidak diminta isi tip
//   63 (CRC)                 dihitung ulang
// Identitas merchant & penerima dana (ID 26–51, 52, 53, 58, 59, 60, …) tidak disentuh,
// jadi uang tetap masuk ke merchant yang sama.
import { getItem, setItem } from './store'

// CRC-16/CCITT-FALSE (poly 0x1021, init 0xFFFF), sesuai spesifikasi QRIS
export function crc16(str) {
  let crc = 0xffff
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8
    for (let b = 0; b < 8; b++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff
  }
  return crc.toString(16).toUpperCase().padStart(4, '0')
}

// [{ id, value }] untuk level teratas. null kalau formatnya rusak.
export function parseTlv(s) {
  const out = []
  let i = 0
  while (i < s.length) {
    const id = s.slice(i, i + 2), len = Number(s.slice(i + 2, i + 4))
    if (!/^\d{2}$/.test(id) || !/^\d{2}$/.test(s.slice(i + 2, i + 4)) || i + 4 + len > s.length) return null
    out.push({ id, value: s.slice(i + 4, i + 4 + len) })
    i += 4 + len
  }
  return out
}

const tlv = (id, value) => `${id}${String(value.length).padStart(2, '0')}${value}`

// Info QRIS kalau teks valid (format + CRC cocok), selain itu null.
export function qrisInfo(payload) {
  const s = String(payload || '').trim()
  // QRIS hanya berisi karakter ASCII cetak; selain itu (mis. hasil baca rusak) ditolak -> fallback gambar statis
  if (!s.startsWith('000201') || s.length < 30 || s.length > 512 || !/^[\x20-\x7e]+$/.test(s)) return null
  const body = s.slice(0, -4)
  if (!body.endsWith('6304') || crc16(body) !== s.slice(-4).toUpperCase()) return null
  const items = parseTlv(s)
  if (!items) return null
  const get = (id) => items.find(t => t.id === id)?.value
  const hasMerchant = items.some(t => Number(t.id) >= 26 && Number(t.id) <= 51)
  if (!hasMerchant || !get('59')) return null
  return { merchantName: get('59'), city: get('60') || '', isStatic: get('01') !== '12', amount: get('54') || null }
}

// Teks QRIS dengan nominal terkunci. amount = rupiah bulat > 0.
export function toDynamic(payload, amount) {
  const amt = Math.round(Number(amount))
  if (!qrisInfo(payload) || !(amt > 0)) return null
  const items = parseTlv(payload.trim()).filter(t => !['01', '54', '55', '56', '57', '63'].includes(t.id))
  // urutan asli dipertahankan; 01 tepat setelah 00, 54 sebelum tag pertama yang > 54
  const out = []
  for (const t of items) {
    if (Number(t.id) > 54 && !out.some(o => o.id === '54')) out.push({ id: '54', value: String(amt) })
    out.push(t)
    if (t.id === '00') out.push({ id: '01', value: '12' })
  }
  if (!out.some(o => o.id === '54')) out.push({ id: '54', value: String(amt) })
  const body = out.map(t => tlv(t.id, t.value)).join('') + '6304'
  return body + crc16(body)
}

// Baca teks QR dari gambar (data URL). Coba ukuran asli lalu versi dikecilkan (foto besar sering gagal).
export async function decodeQrImage(src) {
  if (!src) return null
  const { BrowserQRCodeReader } = await import('@zxing/browser')
  const reader = new BrowserQRCodeReader()
  const tryUrl = async (url) => { try { return (await reader.decodeFromImageUrl(url)).getText() } catch { return null } }
  const direct = await tryUrl(src)
  if (direct) return direct
  try {
    const img = await new Promise((ok, fail) => { const i = new Image(); i.onload = () => ok(i); i.onerror = fail; i.src = src })
    // gambar besar dikecilkan, gambar kecil diperbesar (tanpa smoothing supaya modul QR tetap tajam)
    for (const max of [1000, 600, 1600]) {
      const k = max / Math.max(img.naturalWidth, img.naturalHeight)
      const c = document.createElement('canvas')
      c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k)
      const g = c.getContext('2d'); g.imageSmoothingEnabled = k < 1
      g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height)
      const t = await tryUrl(c.toDataURL('image/png'))
      if (t) return t
    }
  } catch { /* gambar tidak bisa dimuat */ }
  return null
}

export const QRIS_CHANGED = 'pos-qris-changed'

// Teks QRIS statis yang tersimpan di laptop ini. Gambar lama (sebelum fitur ini) dibaca sekali lalu disimpan.
// { onlyEnabled: true } -> null kalau saklar "nominal otomatis" (qrisDynamic) di laptop ini mati.
export async function loadQrisPayload({ onlyEnabled = false } = {}) {
  const ds = (await getItem('kv', 'displaySettings').catch(() => null)) || {}
  if (!ds.qrisImage || (onlyEnabled && !ds.qrisDynamic)) return null
  if (ds.qrisPayloadChecked) return ds.qrisPayload || null
  const text = await decodeQrImage(ds.qrisImage)
  const qrisPayload = qrisInfo(text) ? text.trim() : null
  await setItem('kv', 'displaySettings', { ...ds, qrisPayload, qrisPayloadChecked: true }).catch(() => {})
  return qrisPayload
}
