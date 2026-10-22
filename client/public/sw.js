// Service worker supaya aplikasi (terutama layar kasir) tetap bisa dibuka tanpa internet.
// - halaman (navigasi): ambil dari jaringan dulu, kalau gagal pakai index.html tersimpan
// - /assets/* (nama file ber-hash, tidak pernah berubah): pakai simpanan dulu
// - request API & domain lain tidak disentuh
const CACHE = 'preface-app-v1'

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k)
    await self.clients.claim()
  })())
})

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api')) return

  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      try {
        const res = await fetch(req)
        const cache = await caches.open(CACHE)
        cache.put('/index.html', res.clone())
        return res
      } catch {
        return (await caches.match('/index.html')) || Response.error()
      }
    })())
    return
  }

  if (url.pathname.startsWith('/assets/')) {
    e.respondWith((async () => {
      const hit = await caches.match(req)
      if (hit) return hit
      const res = await fetch(req)
      if (res.ok) (await caches.open(CACHE)).put(req, res.clone())
      return res
    })())
    return
  }

  // file statis lain (favicon, ikon): pakai simpanan, perbarui di belakang
  e.respondWith((async () => {
    const hit = await caches.match(req)
    const net = fetch(req).then(async (res) => {
      if (res.ok) (await caches.open(CACHE)).put(req, res.clone())
      return res
    }).catch(() => hit)
    return hit || net
  })())
})
