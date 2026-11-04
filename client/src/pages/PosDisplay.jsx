import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { Maximize2, WifiOff } from 'lucide-react'
import { getItem, setItem } from '../pos/store'
import { cacheImages, loadCachedImages } from '../pos/images'
import { subscribeDisplay } from '../pos/display'
import { watchRemote } from '../pos/displayRemote'
import { posHttp } from '../pos/sync'
import logo from '../assets/logo-preface-receipt.png?inline'

// Layar pelanggan (jendela kedua di laptop kasir -> monitor / iPad). Hanya menampilkan, tidak ada input.
// Semua teks yang dibaca pembeli berbahasa Inggris.
// Lokal (/pos/display/:eventId): keadaan dari kasir lewat BroadcastChannel, foto & QRIS dari IndexedDB -> jalan offline.
// Perangkat lain (/pos/layar, iPad): masukkan kode dari laptop kasir, keadaan di-relay server (butuh internet);
// katalog & foto diunduh sendiri lalu disimpan di perangkat ini.
const rp = (n) => 'Rp ' + Number(n || 0).toLocaleString('id-ID')
const shortName = (n) => String(n || '').replace(/[\u200b-\u200d\u2060\ufeff]/g, '').replace(/\s+PREFACE\s+-\s+/i, ' · ').replace(/\s+PREFACE$/i, '').trim()
const lineName = (n) => shortName(n).split('·').pop().trim()
const firstName = (n) => String(n || '').trim().split(/\s+/)[0] || ''
const METHOD = { CASH: 'Cash', QRIS: 'QRIS', TRANSFER: 'Transfer', EDC: 'Card', OTHER: 'Other' }
const HEAD = { fontFamily: 'Impact, Haettenschweiler, "Arial Narrow Bold", sans-serif', letterSpacing: '.02em' }
const DONE_MIN_MS = 8000   // ucapan terima kasih tampil minimal selama ini walau kasir sudah lanjut
const DONE_MAX_MS = 20000  // lalu kembali ke tampilan sambutan
const CODE_KEY = 'posDisplayCode'
// Layar penuh lintas browser: Safari iPad memakai versi webkit; dari ikon Home Screen sudah tampil penuh (standalone)
const fsElement = () => document.fullscreenElement || document.webkitFullscreenElement || null
const isStandalone = () => window.navigator.standalone === true || window.matchMedia?.('(display-mode: standalone)').matches
// true hanya kalau benar-benar jadi layar penuh: Safari iPad bisa diam-diam menolak tanpa error
async function enterFullscreen(opts) {
  const el = document.documentElement
  const tries = [
    () => el.requestFullscreen?.(opts),
    () => (opts ? el.requestFullscreen?.() : undefined),
    () => el.webkitRequestFullscreen?.(),
  ]
  for (const t of tries) {
    try {
      const p = t()
      if (p?.then) await Promise.race([p, new Promise(r => setTimeout(r, 1500))])
    } catch { /* coba cara berikutnya */ }
    if (fsElement()) return true
    await new Promise(r => setTimeout(r, 400)) // beri waktu animasi masuk layar penuh
    if (fsElement()) return true
  }
  return false
}
const readCode = () => { try { return localStorage.getItem(CODE_KEY) || '' } catch { return '' } }
const writeCode = (c) => { try { c ? localStorage.setItem(CODE_KEY, c) : localStorage.removeItem(CODE_KEY) } catch { /* mode privat */ } }

// iPad: belum ada kode -> form kode; sudah -> layar pelanggan lewat server
export function PosRemoteDisplay() {
  const [params] = useSearchParams()
  const [code, setCode] = useState(() => params.get('code') || readCode())
  const [error, setError] = useState(null)
  useEffect(() => { document.title = 'Customer Display · Preface' }, [])
  if (!code) return <CodeEntry error={error} onSubmit={(c) => { writeCode(c); setError(null); setCode(c) }} />
  return <PosDisplay remoteCode={code} onRemoteError={(e) => { writeCode(''); setError(e); setCode('') }} />
}

function CodeEntry({ onSubmit, error }) {
  const [v, setV] = useState('')
  const msg = error === 'notfound' ? 'Kode tidak ditemukan. Cek kode di laptop kasir (tombol Layar pelanggan → iPad).'
    : error === 'auth' ? 'Akun ini tidak punya akses POS. Login dengan akun kasir.'
    : error === 'session' ? 'Sesi login habis. Login ulang, lalu masukkan kode lagi.' : null
  return (
    <div className="fixed inset-0 bg-[#0c0c0c] text-white flex items-center justify-center p-6" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      <form className="w-full max-w-sm text-center" onSubmit={e => { e.preventDefault(); if (/^\d{4}$/.test(v)) onSubmit(v) }}>
        <img src={logo} alt="PREFACE" className="h-9 mx-auto" style={{ filter: 'invert(1)' }} />
        <p className="mt-8 text-2xl font-bold">Layar pelanggan</p>
        <p className="mt-2 text-sm text-white/60">Di laptop kasir klik <b className="text-white">Layar pelanggan</b> → <b className="text-white">iPad / perangkat lain</b>, lalu ketik kode 4 digit di sini.</p>
        <input autoFocus inputMode="numeric" pattern="[0-9]*" maxLength={4} value={v} onChange={e => setV(e.target.value.replace(/\D/g, '').slice(0, 4))}
          className="mt-6 w-full h-20 rounded-2xl bg-white/10 text-center text-5xl font-black tracking-[.5em] pl-[.5em] outline-none focus:ring-2 focus:ring-white/50" placeholder="····" />
        {msg && <p className="mt-3 text-sm text-red-400">{msg}</p>}
        {error === 'session' && <a href="/login?next=/pos/layar" onClick={() => { try { localStorage.removeItem('token'); localStorage.removeItem('user') } catch { /* */ } }} className="mt-2 inline-block text-sm font-semibold underline">Login ulang</a>}
        <button disabled={v.length !== 4} className="mt-5 w-full h-14 rounded-2xl bg-white text-black font-bold disabled:opacity-30">Sambungkan</button>
        <a href="/pos" className="mt-6 inline-block text-sm text-white/50 hover:text-white">← Kembali ke POS</a>
      </form>
    </div>
  )
}

export default function PosDisplay({ remoteCode, onRemoteError }) {
  const params = useParams()
  const [remoteEventId, setRemoteEventId] = useState(null)
  const eventId = remoteCode ? remoteEventId : params.eventId
  const [conn, setConn] = useState({ online: true })
  const [shown, setShown] = useState({ phase: 'idle' })
  const [catalog, setCatalog] = useState(null)
  const [imgs, setImgs] = useState({})
  const [qris, setQris] = useState(null)
  const [full, setFull] = useState(() => !!fsElement() || isStandalone())
  const [fsHelp, setFsHelp] = useState(false)
  const [target, setTarget] = useState(null)   // layar eksternal tujuan (monitor / iPad)
  const doneAt = useRef(0)
  const holdTimer = useRef(null)

  // "done" ditahan minimal DONE_MIN_MS supaya pembeli sempat baca nomor ambil & ucapan
  const apply = useCallback((s) => {
    clearTimeout(holdTimer.current)
    if (s.phase === 'done') doneAt.current = Date.now()
    const wait = s.phase === 'idle' && doneAt.current ? DONE_MIN_MS - (Date.now() - doneAt.current) : 0
    if (wait > 0) holdTimer.current = setTimeout(() => setShown(s), wait)
    else setShown(s)
    if (s.phase !== 'done' && wait <= 0) doneAt.current = 0
  }, [])

  // iPad: dengarkan kasir lewat server
  useEffect(() => {
    if (!remoteCode) return
    let first = true
    return watchRemote(remoteCode, {
      onState: (d) => {
        setRemoteEventId(d.eventId)
        // baru tersambung saat kasir di layar "terima kasih" yang sudah lama -> mulai dari sambutan
        if (first && d.state?.phase === 'done') apply({ phase: 'idle' }); else apply(d.state || { phase: 'idle' })
        first = false
      },
      onQris: (q) => setQris(q || null),
      onConn: (c) => { setConn(c); if (c.error) onRemoteError?.(c.error) },
    })
  }, [remoteCode, apply]) // eslint-disable-line react-hooks/exhaustive-deps

  // iPad: katalog & foto diunduh sendiri (disimpan, jadi tetap bergambar kalau internet sempat putus)
  useEffect(() => {
    if (!remoteCode || !eventId) return
    let live = true
    const load = async () => {
      let cat = await getItem('kv', `catalog:${eventId}`).catch(() => null)
      if (cat && live) { setCatalog(cat); setImgs(await loadCachedImages(cat.items)) }
      try {
        const { data } = await posHttp.get(`/pos/events/${eventId}/catalog`, { timeout: 30_000 })
        cat = data
        await setItem('kv', `catalog:${eventId}`, data).catch(() => {})
        if (!live) return
        setCatalog(data)
        setImgs(await cacheImages(data.items))
      } catch { /* offline: pakai simpanan */ }
    }
    load()
    const t = setInterval(load, 10 * 60_000)
    return () => { live = false; clearInterval(t) }
  }, [remoteCode, eventId])

  useEffect(() => {
    document.title = 'Customer Display · Preface'
    if (remoteCode) return
    const loadAssets = async () => {
      const cat = await getItem('kv', `catalog:${eventId}`).catch(() => null)
      if (cat) { setCatalog(cat); setImgs(await loadCachedImages(cat.items)) }
      const ds = await getItem('kv', 'displaySettings').catch(() => null)
      setQris(ds?.qrisImage || null)
    }
    loadAssets()
    const t = setInterval(loadAssets, 60_000)
    const off = subscribeDisplay(eventId, (s) => {
      if (s.phase === 'pay') loadAssets()
      apply(s)
    })
    // cari layar eksternal; tanpa izin "kelola jendela" -> layar penuh di layar tempat jendela ini berada
    let details = null
    const pickTarget = () => setTarget(details?.screens.find(x => !x.isPrimary) || null)
    const findScreens = async () => {
      if (!('getScreenDetails' in window) || !window.screen.isExtended) { setTarget(null); return }
      const perm = await navigator.permissions.query({ name: 'window-management' }).catch(() => null)
      if (perm?.state !== 'granted') return
      details = await window.getScreenDetails().catch(() => null)
      details?.addEventListener('screenschange', pickTarget)
      pickTarget()
    }
    findScreens()
    window.screen.addEventListener?.('change', findScreens)
    return () => {
      clearInterval(t); clearTimeout(holdTimer.current); off()
      window.screen.removeEventListener?.('change', findScreens); details?.removeEventListener('screenschange', pickTarget)
    }
  }, [eventId, remoteCode, apply])

  // status layar penuh (lokal & iPad)
  useEffect(() => {
    const fs = () => setFull(!!fsElement() || isStandalone())
    document.addEventListener('fullscreenchange', fs)
    document.addEventListener('webkitfullscreenchange', fs)
    return () => { document.removeEventListener('fullscreenchange', fs); document.removeEventListener('webkitfullscreenchange', fs) }
  }, [])

  useEffect(() => {
    if (shown.phase !== 'done') return
    const t = setTimeout(() => setShown({ phase: 'idle' }), DONE_MAX_MS)
    return () => clearTimeout(t)
  }, [shown])

  const event = catalog?.event
  return (
    <div onScroll={e => { if (e.currentTarget.scrollLeft || e.currentTarget.scrollTop) e.currentTarget.scrollTo(0, 0) }} className="fixed inset-0 bg-[#0c0c0c] text-white overflow-hidden select-none cursor-none" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
      onMouseMove={e => { e.currentTarget.style.cursor = 'default'; clearTimeout(e.currentTarget._t); const el = e.currentTarget; el._t = setTimeout(() => { el.style.cursor = 'none' }, 2000) }}>
      <style>{`
        @keyframes pd-marquee { from { transform: translateX(0) } to { transform: translateX(-50%) } }
        @keyframes pd-in { from { opacity: 0; transform: translateY(14px) } to { opacity: 1; transform: none } }
        @keyframes pd-flash { 0% { background: rgba(255,255,255,.22) } 100% { background: transparent } }
        @keyframes pd-pop { 0% { transform: scale(.92); opacity: 0 } 100% { transform: scale(1); opacity: 1 } }
        .pd-in { animation: pd-in .45s cubic-bezier(.2,.7,.2,1) both }
        .pd-flash { animation: pd-flash 1.4s ease-out }
        .pd-pop { animation: pd-pop .5s cubic-bezier(.2,.8,.2,1.2) both }
      `}</style>

      {shown.phase === 'idle' && <Idle catalog={catalog} imgs={imgs} event={event} />}
      {(shown.phase === 'cart' || shown.phase === 'pay') && <Cart s={shown} imgs={imgs} qris={qris} />}
      {shown.phase === 'done' && <Done d={shown.done} />}

      {remoteCode && !conn.online && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 inline-flex items-center gap-2 px-4 h-9 rounded-full bg-red-600/90 text-sm font-semibold">
          <WifiOff size={15} />Terputus dari kasir — menyambung ulang…
        </div>
      )}

      {!full && (
        <button onClick={async () => {
          // izin belum ada -> minta sekarang (butuh klik), lalu tampil penuh di layar eksternal
          let scr = target
          if (!scr && window.screen.isExtended && 'getScreenDetails' in window) {
            const d = await window.getScreenDetails().catch(() => null)
            scr = d?.screens.find(x => !x.isPrimary) || null
            setTarget(scr)
          }
          const ok = await enterFullscreen(scr ? { screen: scr } : undefined)
          if (!ok) setFsHelp(true)
        }}
          className="absolute bottom-4 right-4 z-50 inline-flex items-center gap-2 px-4 h-10 rounded-full bg-white/10 hover:bg-white/20 text-sm font-semibold cursor-pointer backdrop-blur">
          <Maximize2 size={15} />{target ? `Full screen on ${target.label || 'external display'}` : 'Tap for full screen'}
        </button>
      )}

      {remoteCode && !full && (
        <button onClick={() => onRemoteError?.(null)} className="absolute bottom-4 left-4 z-50 inline-flex items-center gap-2 px-4 h-10 rounded-full bg-white/10 hover:bg-white/20 text-sm font-semibold cursor-pointer backdrop-blur">
          Ganti kode · {remoteCode}
        </button>
      )}

      {fsHelp && !full && (
        <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-6" onClick={() => setFsHelp(false)}>
          <div className="max-w-md rounded-3xl bg-white text-black p-8 text-center" onClick={e => e.stopPropagation()}>
            <p className="text-xl font-bold">Layar penuh di iPad</p>
            <p className="mt-3 text-sm text-black/70 leading-relaxed">Browser ini tidak mengizinkan layar penuh. Pakai cara ini:<br />
              1. Tap tombol <b>Share</b> (kotak panah ke atas) di Safari<br />
              2. Pilih <b>Add to Home Screen</b> → <b>Add</b><br />
              3. Buka <b>Preface</b> dari ikon di Home Screen — tampil penuh tanpa bar Safari</p>
            <button className="mt-6 h-11 px-6 rounded-full bg-black text-white font-semibold" onClick={() => setFsHelp(false)}>Mengerti</button>
          </div>
        </div>
      )}
    </div>
  )
}

function Brand({ dark }) {
  return (
    <div className="relative z-10 flex items-center justify-between px-10 pt-8">
      <img src={logo} alt="PREFACE" className="h-9" style={{ filter: dark ? 'none' : 'invert(1)' }} />
      <span className={`text-sm font-semibold tracking-[.25em] ${dark ? 'text-black/60' : 'text-white/60'}`}>@PREFACEWEARHOUSE</span>
    </div>
  )
}

// ── Sambutan: mosaik foto produk berjalan + judul besar ─────────────────────
function Idle({ catalog, imgs, event }) {
  const photos = useMemo(() => {
    const seen = new Set(), out = []
    const hidden = new Set(catalog?.event?.displayHiddenProductIds ?? []) // diatur di Edit Event
    for (const it of catalog?.items ?? []) if (imgs[it.productId] && !seen.has(it.productId) && !hidden.has(it.productId)) { seen.add(it.productId); out.push({ src: imgs[it.productId], name: lineName(it.name) }) }
    return out
  }, [catalog, imgs])
  const rows = [0, 1, 2].map(r => {
    // foto sedikit -> tiap baris pakai semua foto, digeser supaya tidak sejajar
    const list = photos.length >= 9 ? photos.filter((_, i) => i % 3 === r) : photos.map((_, i) => photos[(i + r) % photos.length])
    const fill = list.length ? Array.from({ length: Math.max(8, list.length) }, (_, i) => list[i % list.length]) : []
    return fill
  })
  return (
    <div className="absolute inset-0 flex flex-col">
      <Brand />
      <div className="absolute inset-0 top-24 flex flex-col justify-center gap-4 opacity-45 overflow-hidden">
        {rows.map((row, r) => row.length > 0 && (
          <div key={r} className="flex gap-4 w-max" style={{ animation: `pd-marquee ${60 + r * 15}s linear infinite`, animationDirection: r % 2 ? 'reverse' : 'normal' }}>
            {[...row, ...row].map((p, i) => <img key={i} src={p.src} alt="" className="w-52 h-52 rounded-2xl object-cover grayscale-[30%]" />)}
          </div>
        ))}
      </div>
      <div className="absolute inset-0 bg-gradient-to-t from-[#0c0c0c] via-[#0c0c0c]/40 to-[#0c0c0c]/70" />
      <div className="relative mt-auto px-10 pb-14 pd-in">
        <p className="text-sm font-bold tracking-[.4em] text-white/60">{(event?.name || 'POP UP').toUpperCase()}</p>
        <p className="text-[120px] leading-[.9] uppercase" style={HEAD}>Welcome to<br />Preface ★</p>
        <p className="mt-5 text-lg text-white/70">Pick your favorites, our cashier is ready to help. <span className="text-white">Follow @prefacewearhouse</span></p>
      </div>
    </div>
  )
}

// ── Keranjang & bayar ──────────────────────────────────────────────────────
function Cart({ s, imgs, qris }) {
  const listRef = useRef(null)
  const pay = s.phase === 'pay' ? s.pay : null
  const showQris = pay && pay.methods?.includes('QRIS')
  useEffect(() => { // item yang baru discan selalu terlihat
    const el = listRef.current?.querySelector(`[data-sku="${s.lastSku}"]`)
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [s.lastSku, s.lastAt])
  return (
    <div className="absolute inset-0 flex">
      <div className="flex-1 min-w-0 flex flex-col">
        <Brand />
        <div className="px-10 mt-8 flex items-end justify-between">
          <p className="text-5xl uppercase" style={HEAD}>Your Cart</p>
          <p className="text-white/50 font-semibold">{s.pcs} {s.pcs === 1 ? 'item' : 'items'}</p>
        </div>
        <div ref={listRef} className="flex-1 overflow-y-auto px-10 py-5 space-y-2.5">
          {s.lines.map((l, i) => (
            <div key={`${l.skuId}-${l.skuId === s.lastSku ? s.lastAt : ''}`} data-sku={l.skuId}
              className={`flex items-center gap-5 rounded-2xl bg-white/[.05] p-3 pr-5 ${l.skuId === s.lastSku ? 'pd-flash' : ''}`}>
              <span className="w-8 text-white/30 text-lg" style={HEAD}>{String(i + 1).padStart(2, '0')}</span>
              {imgs[l.productId]
                ? <img src={imgs[l.productId]} alt="" className="w-20 h-20 rounded-xl object-cover" />
                : <div className="w-20 h-20 rounded-xl bg-white/10 flex items-center justify-center text-center text-[11px] font-black tracking-wide text-white/40 uppercase p-1">{lineName(l.name)}</div>}
              <div className="flex-1 min-w-0">
                <p className="text-xl font-bold truncate">{shortName(l.name)}</p>
                <div className="mt-1.5 flex items-center gap-2 text-sm">
                  {l.variant && <span className="px-2 py-0.5 rounded-md border border-white/40 font-bold">SIZE {l.variant}</span>}
                  <span className="text-white/60">{l.qty} × {rp(l.unitPrice)}</span>
                  {l.discount > 0 && <span className="text-emerald-400 font-semibold">save {rp(l.discount)}</span>}
                </div>
              </div>
              <p className="text-2xl font-black tabular-nums">{rp(l.lineTotal)}</p>
            </div>
          ))}
        </div>
      </div>

      {/* panel total */}
      <div className="w-[38%] min-w-[360px] max-w-[520px] bg-white text-black flex flex-col">
        <div className="flex-1 flex flex-col justify-center px-10">
          {showQris ? (
            <div className="text-center pd-pop">
              <p className="text-sm font-bold tracking-[.3em] text-black/50">SCAN TO PAY</p>
              {qris
                ? <img src={qris} alt="QRIS" className="mx-auto mt-4 w-full max-w-[340px] aspect-square object-contain" />
                : <div className="mx-auto mt-4 w-full max-w-[300px] aspect-square rounded-2xl border-4 border-dashed border-black/20 flex items-center justify-center text-black/40 text-sm p-6">QRIS code not available yet</div>}
            </div>
          ) : (
            <div className="space-y-3 text-lg">
              {!pay && (
                <div className="mb-6">
                  <p className="text-4xl uppercase leading-none" style={HEAD}>Double-check ★</p>
                  <p className="mt-2 text-base text-black/60">Make sure the items, sizes and quantities are right before you pay.</p>
                </div>
              )}
              <Row label="Subtotal" value={rp(s.subtotal)} />
              {s.discount > 0 && <Row label="Discount" value={`-${rp(s.discount)}`} className="text-emerald-600" />}
              {pay?.fulfillment === 'LATER' && <p className="rounded-xl bg-black/5 px-4 py-3 text-base">Your items will be <b>picked up later</b>. Your pickup number appears after payment.</p>}
              {pay && pay.cashReceived > 0 && (
                <div className="pt-2 space-y-2">
                  <Row label="Cash received" value={rp(pay.cashReceived)} />
                  {pay.change >= 0 && <Row label="Change" value={rp(pay.change)} bold />}
                </div>
              )}
            </div>
          )}
        </div>
        <div className="bg-black text-white px-10 py-8">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold tracking-[.3em] text-white/60">{pay ? 'AMOUNT DUE' : 'TOTAL'}</p>
            {pay && pay.methods.length > 0 && <p className="text-sm font-semibold text-white/70">{pay.methods.map(m => METHOD[m] || m).join(' + ')}</p>}
          </div>
          <p key={s.total} className="text-[clamp(44px,5.2vw,80px)] leading-none mt-2 tabular-nums whitespace-nowrap pd-pop" style={HEAD}>{rp(s.total)}</p>
        </div>
      </div>
    </div>
  )
}

function Row({ label, value, bold, className = '' }) {
  return <div className={`flex justify-between ${bold ? 'text-2xl font-black' : ''} ${className}`}><span className={bold ? '' : 'text-black/60'}>{label}</span><span className="font-bold tabular-nums">{value}</span></div>
}

// ── Terima kasih ───────────────────────────────────────────────────────────
function Done({ d }) {
  const later = d.fulfillment === 'LATER'
  const name = firstName(d.customerName)
  return (
    <div className="absolute inset-0 bg-white text-black flex flex-col">
      <Brand dark />
      <div className="flex-1 flex items-center px-10 gap-10">
        <div className="flex-1 pd-in">
          <p className="text-sm font-bold tracking-[.4em] text-black/50">PAYMENT SUCCESSFUL</p>
          <p className="text-[110px] leading-[.88] uppercase mt-3" style={HEAD}>Thank you{name ? <>,<br />{name}</> : ''}</p>
          <p className="text-3xl uppercase mt-4" style={HEAD}>for copping Preface ★</p>
          {d.change > 0 && <p className="mt-8 text-2xl">Change <b className="tabular-nums">{rp(d.change)}</b></p>}
          <p className="mt-3 text-lg text-black/60">Your receipt is printed by the cashier · follow <b className="text-black">@prefacewearhouse</b></p>
        </div>
        {later && (
          <div className="w-[38%] min-w-[320px] bg-black text-white rounded-3xl p-10 text-center pd-pop">
            <p className="text-sm font-bold tracking-[.35em] text-white/60">PICKUP NUMBER</p>
            <p className="text-[96px] leading-none mt-3" style={HEAD}>{d.pickupCode}</p>
            <p className="mt-5 text-lg text-white/80 leading-snug">Your items are being prepared.<br />Show your receipt at the pickup counter.</p>
          </div>
        )}
      </div>
    </div>
  )
}
