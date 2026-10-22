// Penyimpanan lokal kasir (IndexedDB) supaya kasir tetap jalan saat internet putus.
// - kv:    katalog per event, shift aktif, nomor urut transaksi, pengaturan struk
// - queue: transaksi yang belum terkirim ke server (kunci = clientOrderId)
// - sent:  transaksi yang sudah terkirim (untuk riwayat & cetak ulang struk)
const DB_NAME = 'preface-pos'
const STORES = ['kv', 'queue', 'sent']

let dbPromise = null
function db() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1)
      req.onupgradeneeded = () => {
        for (const s of STORES) if (!req.result.objectStoreNames.contains(s)) req.result.createObjectStore(s)
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
  }
  return dbPromise
}

async function run(store, mode, fn) {
  const d = await db()
  return new Promise((resolve, reject) => {
    const tx = d.transaction(store, mode)
    const result = fn(tx.objectStore(store))
    tx.oncomplete = () => resolve(result?.result)
    tx.onerror = () => reject(tx.error)
  })
}

export const getItem = (store, key) => run(store, 'readonly', s => s.get(key))
export const setItem = (store, key, value) => run(store, 'readwrite', s => s.put(value, key))
export const delItem = (store, key) => run(store, 'readwrite', s => s.delete(key))
export const allItems = (store) => run(store, 'readonly', s => s.getAll())

// Minta browser tidak menghapus data kasir saat ruang disk sempit.
export async function requestPersistence() {
  try { return await navigator.storage?.persist?.() } catch { return false }
}

// ID laptop: dibuat sekali, dipakai di nomor transaksi supaya 2 laptop tidak bentrok.
export async function deviceId() {
  let id = await getItem('kv', 'deviceId')
  if (!id) {
    id = Math.random().toString(36).slice(2, 6).toUpperCase()
    await setItem('kv', 'deviceId', id)
  }
  return id
}

export async function nextSeq(eventId) {
  const key = `seq:${eventId}`
  const n = ((await getItem('kv', key)) || 0) + 1
  await setItem('kv', key, n)
  return n
}
