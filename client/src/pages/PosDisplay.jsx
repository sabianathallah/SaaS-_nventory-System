import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Maximize2 } from 'lucide-react'
import { getItem } from '../pos/store'
import { loadCachedImages } from '../pos/images'
import { subscribeDisplay } from '../pos/display'
import logo from '../assets/logo-preface-receipt.png?inline'

// Layar pelanggan (jendela kedua di laptop kasir -> monitor / iPad). Hanya menampilkan, tidak ada input.
// Keadaan datang dari kasir lewat BroadcastChannel, foto & QRIS dibaca dari IndexedDB -> jalan offline.
const rp = (n) => 'Rp ' + Number(n || 0).toLocaleString('id-ID')
const shortName = (n) => String(n || '').replace(/[\u200b-\u200d\u2060\ufeff]/g, '').replace(/\s+PREFACE\s+-\s+/i, ' · ').replace(/\s+PREFACE$/i, '').trim()
const lineName = (n) => shortName(n).split('·').pop().trim()
const firstName = (n) => String(n || '').trim().split(/\s+/)[0] || ''
const METHOD = { CASH: 'Tunai', QRIS: 'QRIS', TRANSFER: 'Transfer', EDC: 'Kartu', OTHER: 'Lainnya' }
const HEAD = { fontFamily: 'Impact, Haettenschweiler, "Arial Narrow Bold", sans-serif', letterSpacing: '.02em' }
const DONE_MIN_MS = 8000   // ucapan terima kasih tampil minimal selama ini walau kasir sudah lanjut
const DONE_MAX_MS = 20000  // lalu kembali ke tampilan sambutan

export default function PosDisplay() {
  const { eventId } = useParams()
  const [shown, setShown] = useState({ phase: 'idle' })
  const [catalog, setCatalog] = useState(null)
  const [imgs, setImgs] = useState({})
  const [qris, setQris] = useState(null)
  const [full, setFull] = useState(!!document.fullscreenElement)
  const [target, setTarget] = useState(null)   // layar eksternal tujuan (monitor / iPad)
  const doneAt = useRef(0)
  const holdTimer = useRef(null)

  useEffect(() => {
    document.title = 'Layar Pelanggan · Preface'
    const loadAssets = async () => {
      const cat = await getItem('kv', `catalog:${eventId}`).catch(() => null)
      if (cat) { setCatalog(cat); setImgs(await loadCachedImages(cat.items)) }
      const ds = await getItem('kv', 'displaySettings').catch(() => null)
      setQris(ds?.qrisImage || null)
    }
    loadAssets()
    const t = setInterval(loadAssets, 60_000)
    // "done" ditahan minimal DONE_MIN_MS supaya pembeli sempat baca nomor ambil & ucapan
    const off = subscribeDisplay(eventId, (s) => {
      if (s.phase === 'pay') loadAssets()
      clearTimeout(holdTimer.current)
      if (s.phase === 'done') doneAt.current = Date.now()
      const wait = s.phase === 'idle' && doneAt.current ? DONE_MIN_MS - (Date.now() - doneAt.current) : 0
      if (wait > 0) holdTimer.current = setTimeout(() => setShown(s), wait)
      else setShown(s)
      if (s.phase !== 'done' && wait <= 0) doneAt.current = 0
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
    const fs = () => setFull(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', fs)
    return () => {
      clearInterval(t); clearTimeout(holdTimer.current); off(); document.removeEventListener('fullscreenchange', fs)
      window.screen.removeEventListener?.('change', findScreens); details?.removeEventListener('screenschange', pickTarget)
    }
  }, [eventId])

  useEffect(() => {
    if (shown.phase !== 'done') return
    const t = setTimeout(() => setShown({ phase: 'idle' }), DONE_MAX_MS)
    return () => clearTimeout(t)
  }, [shown])

  const event = catalog?.event
  return (
    <div className="fixed inset-0 bg-[#0c0c0c] text-white overflow-hidden select-none cursor-none" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
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

      {!full && (
        <button onClick={async () => {
          // izin belum ada -> minta sekarang (butuh klik), lalu tampil penuh di layar eksternal
          let scr = target
          if (!scr && window.screen.isExtended && 'getScreenDetails' in window) {
            const d = await window.getScreenDetails().catch(() => null)
            scr = d?.screens.find(x => !x.isPrimary) || null
            setTarget(scr)
          }
          document.documentElement.requestFullscreen?.(scr ? { screen: scr } : undefined).catch(() => document.documentElement.requestFullscreen?.().catch(() => {}))
        }}
          className="absolute bottom-4 right-4 z-50 inline-flex items-center gap-2 px-4 h-10 rounded-full bg-white/10 hover:bg-white/20 text-sm font-semibold cursor-pointer backdrop-blur">
          <Maximize2 size={15} />{target ? `Tampilkan layar penuh di ${target.label || 'layar eksternal'}` : 'Klik untuk layar penuh'}
        </button>
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
    for (const it of catalog?.items ?? []) if (imgs[it.productId] && !seen.has(it.productId)) { seen.add(it.productId); out.push({ src: imgs[it.productId], name: lineName(it.name) }) }
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
      <div className="absolute inset-0 top-24 flex flex-col justify-center gap-4 opacity-45">
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
        <p className="mt-5 text-lg text-white/70">Pilih barang favoritmu, kasir siap membantu. <span className="text-white">Follow @prefacewearhouse</span></p>
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
          <p className="text-5xl uppercase" style={HEAD}>Belanjaanmu</p>
          <p className="text-white/50 font-semibold">{s.pcs} barang</p>
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
                  {l.discount > 0 && <span className="text-emerald-400 font-semibold">hemat {rp(l.discount)}</span>}
                </div>
              </div>
              <p className="text-2xl font-black tabular-nums">{rp(l.lineTotal)}</p>
            </div>
          ))}
          {(s.returns || []).map(r => (
            <div key={`ret-${r.skuId}`} className="flex items-center gap-5 rounded-2xl border border-dashed border-white/25 p-3 pr-5 text-white/70">
              <span className="w-8 text-lg" style={HEAD}>↩</span>
              {imgs[r.productId]
                ? <img src={imgs[r.productId]} alt="" className="w-20 h-20 rounded-xl object-cover opacity-60" />
                : <div className="w-20 h-20 rounded-xl bg-white/10 flex items-center justify-center text-center text-[11px] font-black tracking-wide text-white/40 uppercase p-1">{lineName(r.name)}</div>}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold tracking-[.3em] text-white/50">DIKEMBALIKAN</p>
                <p className="text-xl font-bold truncate">{shortName(r.name)}</p>
                <div className="mt-1.5 flex items-center gap-2 text-sm">
                  {r.variant && <span className="px-2 py-0.5 rounded-md border border-white/30 font-bold">SIZE {r.variant}</span>}
                  <span className="text-white/50">{r.qty} × {rp(r.credit)}</span>
                </div>
              </div>
              <p className="text-2xl font-black tabular-nums">-{rp(r.qty * r.credit)}</p>
            </div>
          ))}
        </div>
      </div>

      {/* panel total */}
      <div className="w-[38%] min-w-[360px] max-w-[520px] bg-white text-black flex flex-col">
        <div className="flex-1 flex flex-col justify-center px-10">
          {showQris ? (
            <div className="text-center pd-pop">
              <p className="text-sm font-bold tracking-[.3em] text-black/50">SCAN UNTUK BAYAR</p>
              {qris
                ? <img src={qris} alt="QRIS" className="mx-auto mt-4 w-full max-w-[340px] aspect-square object-contain" />
                : <div className="mx-auto mt-4 w-full max-w-[300px] aspect-square rounded-2xl border-4 border-dashed border-black/20 flex items-center justify-center text-black/40 text-sm p-6">Gambar QRIS belum diunggah di pengaturan kasir</div>}
            </div>
          ) : (
            <div className="space-y-3 text-lg">
              {!pay && (
                <div className="mb-6">
                  <p className="text-4xl uppercase leading-none" style={HEAD}>Cek lagi ya ★</p>
                  <p className="mt-2 text-base text-black/60">Pastikan produk, size, dan jumlahnya sudah sesuai sebelum bayar.</p>
                </div>
              )}
              <Row label="Subtotal" value={rp(s.subtotal)} />
              {s.discount > 0 && <Row label="Diskon" value={`-${rp(s.discount)}`} className="text-emerald-600" />}
              {s.returnTotal > 0 && <Row label="Barang dikembalikan" value={`-${rp(s.returnTotal)}`} />}
              {pay?.fulfillment === 'LATER' && <p className="rounded-xl bg-black/5 px-4 py-3 text-base">Barang <b>diambil nanti</b> — nomor ambil muncul setelah bayar.</p>}
              {pay && pay.cashReceived > 0 && (
                <div className="pt-2 space-y-2">
                  <Row label="Uang diterima" value={rp(pay.cashReceived)} />
                  {pay.change >= 0 && <Row label="Kembalian" value={rp(pay.change)} bold />}
                </div>
              )}
            </div>
          )}
        </div>
        <div className="bg-black text-white px-10 py-8">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold tracking-[.3em] text-white/60">{s.total < 0 ? 'UANG KEMBALI' : s.returnTotal > 0 ? 'SELISIH' : pay ? 'TOTAL BAYAR' : 'TOTAL'}</p>
            {pay && pay.methods.length > 0 && <p className="text-sm font-semibold text-white/70">{pay.methods.map(m => METHOD[m] || m).join(' + ')}</p>}
          </div>
          <p key={s.total} className="text-[clamp(44px,5.2vw,80px)] leading-none mt-2 tabular-nums whitespace-nowrap pd-pop" style={HEAD}>{rp(Math.abs(s.total))}</p>
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
          <p className="text-sm font-bold tracking-[.4em] text-black/50">{d.exchange ? 'TUKAR BERHASIL' : 'PEMBAYARAN BERHASIL'}</p>
          <p className="text-[110px] leading-[.88] uppercase mt-3" style={HEAD}>Thank you{name ? <>,<br />{name}</> : ''}</p>
          <p className="text-3xl uppercase mt-4" style={HEAD}>for copping Preface ★</p>
          {d.change > 0 && <p className="mt-8 text-2xl">Kembalian <b className="tabular-nums">{rp(d.change)}</b></p>}
          {d.refund > 0 && <p className="mt-8 text-2xl">Uang kembali <b className="tabular-nums">{rp(d.refund)}</b></p>}
          <p className="mt-3 text-lg text-black/60">Struk dicetak oleh kasir · follow <b className="text-black">@prefacewearhouse</b></p>
        </div>
        {later && (
          <div className="w-[38%] min-w-[320px] bg-black text-white rounded-3xl p-10 text-center pd-pop">
            <p className="text-sm font-bold tracking-[.35em] text-white/60">NOMOR AMBIL</p>
            <p className="text-[96px] leading-none mt-3" style={HEAD}>{d.pickupCode}</p>
            <p className="mt-5 text-lg text-white/80 leading-snug">Barangmu sedang disiapkan.<br />Tunjukkan struk ini di bagian pengambilan.</p>
          </div>
        )}
      </div>
    </div>
  )
}
