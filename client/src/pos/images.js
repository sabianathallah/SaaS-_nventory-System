// Foto produk kasir: versi kecil dari Cloudinary disimpan sebagai Blob di IndexedDB,
// jadi grid tetap bergambar walau internet putus. Gagal unduh = tampil inisial.
import { getItem, setItem } from './store'

// /upload/xxx.jpg -> /upload/w_240,h_240,c_fill,q_auto,f_auto/xxx.jpg (hanya untuk URL Cloudinary)
export function thumbUrl(url) {
  if (!url) return null
  return /res\.cloudinary\.com\/.+\/upload\//.test(url) ? url.replace('/upload/', '/upload/w_240,h_240,c_fill,q_auto,f_auto/') : url
}

const objectUrls = new Map() // productId -> blob: URL (hidup selama halaman terbuka)

export async function loadCachedImages(items) {
  const out = {}
  for (const it of uniqueByProduct(items)) {
    if (objectUrls.has(it.productId)) { out[it.productId] = objectUrls.get(it.productId); continue }
    const rec = await getItem('img', it.productId)
    if (rec?.blob && rec.src === it.imageUrl) {
      const u = URL.createObjectURL(rec.blob); objectUrls.set(it.productId, u); out[it.productId] = u
    }
  }
  return out
}

// Unduh foto yang belum tersimpan (atau fotonya berganti). Dipanggil saat katalog berhasil diunduh online.
export async function cacheImages(items, onProgress) {
  const todo = []
  for (const it of uniqueByProduct(items)) {
    if (!it.imageUrl) continue
    const rec = await getItem('img', it.productId)
    if (!rec || rec.src !== it.imageUrl) todo.push(it)
  }
  let done = 0
  const worker = async () => {
    while (todo.length) {
      const it = todo.shift()
      try {
        const res = await fetch(thumbUrl(it.imageUrl), { mode: 'cors' })
        if (res.ok) {
          const blob = await res.blob()
          await setItem('img', it.productId, { src: it.imageUrl, blob })
          objectUrls.set(it.productId, URL.createObjectURL(blob))
        }
      } catch { /* offline / CORS: tampil inisial */ }
      onProgress?.(++done)
    }
  }
  await Promise.all(Array.from({ length: 6 }, worker))
  return Object.fromEntries(objectUrls)
}

function uniqueByProduct(items) {
  const seen = new Map()
  for (const it of items || []) if (!seen.has(it.productId)) seen.set(it.productId, it)
  return [...seen.values()]
}
