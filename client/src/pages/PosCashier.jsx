import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  ArrowLeft, Minus, Plus, Printer, RefreshCw, Settings, Trash2, Wifi, WifiOff, X, LogOut, History,
  Search, ScanLine, Monitor, ShoppingBag, CheckCircle2, PackageCheck, Banknote, QrCode, CreditCard, Landmark, Wallet, Tag, Store,
  ArrowLeftRight, PauseCircle, Undo2,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import NoPermission from '../components/NoPermission'
import Modal from '../components/Modal'
import { allItems, delItem, deviceId, getItem, nextSeq, requestPersistence, setItem } from '../pos/store'
import { enqueueOrder, onSyncChange, posHttp, startAutoSync, syncQueue, syncState } from '../pos/sync'
import { DEFAULT_RECEIPT, RECEIPT_STYLES, orderPrintHtml, printReceipt } from '../pos/receipt'
import { cacheImages, loadCachedImages } from '../pos/images'
import { onScreensChange, openDisplayWindow, publishDisplay } from '../pos/display'
import { isLimited, limitedNet, returnCredits, returnedLocally } from '../pos/exchange'

const rp = (n) => 'Rp ' + Number(n || 0).toLocaleString('id-ID')
const METHODS = [
  { key: 'CASH', label: 'Tunai', icon: Banknote }, { key: 'QRIS', label: 'QRIS', icon: QrCode },
  { key: 'TRANSFER', label: 'Transfer', icon: Landmark }, { key: 'EDC', label: 'Kartu (EDC)', icon: CreditCard },
  { key: 'OTHER', label: 'Lainnya', icon: Wallet },
]
// Nominal tunai cepat: dibulatkan ke atas mengikuti pecahan uang yang biasa dibayar pembeli
function quickCash(amount) {
  const out = new Set()
  const base = Math.ceil(amount / 50000) * 50000
  out.add(base); out.add(base + 50000); out.add(base + 100000)
  for (const step of [500000, 1000000]) out.add(Math.ceil(amount / step) * step)
  for (const v of [100000, 200000, 500000, 1000000]) if (v > amount) out.add(v)
  return [...out].filter(v => v > amount).sort((a, b) => a - b).slice(0, 5)
}
const SIZE_ORDER = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL']
const SIZE_WORDS = new Set(SIZE_ORDER.map(s => s.toLowerCase()))

// "10%" -> persen dari base, "25000" / "25.000" -> rupiah. Dibatasi 0..base.
function parseDiscount(text, base) {
  const s = String(text || '').trim()
  if (!s) return 0
  const v = s.endsWith('%') ? Math.round(base * Number(s.slice(0, -1).replace(',', '.')) / 100) : Number(s.replace(/[^\d]/g, ''))
  return Number.isFinite(v) ? Math.min(Math.max(v, 0), base) : 0
}
const num = (s) => Number(String(s || '').replace(/[^\d]/g, '')) || 0
// nama tampilan di kasir: merek tidak perlu diulang di setiap kartu
const shortName = (n) => String(n || '').replace(/[\u200b-\u200d\u2060\ufeff]/g, '').replace(/\s+PREFACE\s+-\s+/i, ' · ').replace(/\s+PREFACE$/i, '').trim()
const initials = (n) => shortName(n).split(/[\s·-]+/).filter(Boolean).slice(-2).map(w => w[0]).join('').toUpperCase()
const lineName = (n) => shortName(n).split('·').pop().trim()
const digits = (s) => String(s || '').replace(/\D/g, '')
const MAX_HELD = 5

export default function PosCashier() {
  const { eventId } = useParams()
  const navigate = useNavigate()
  const { user, hasPermission } = useAuth()
  const allowed = hasPermission('pos.manage') || hasPermission('pos.sell')

  const [catalog, setCatalog] = useState(null)      // { event, generatedAt, items }
  const [catalogError, setCatalogError] = useState(null)
  const [imgs, setImgs] = useState({})              // productId -> blob URL
  const [shift, setShift] = useState(undefined)     // undefined = memuat, null = belum buka
  const [device, setDevice] = useState('')
  const [settings, setSettings] = useState({ ...DEFAULT_RECEIPT, autoPrint: true })
  const [cart, setCart] = useState([])              // { skuId, productId, code, name, variant, listPrice, unitPrice, qty, discountText }
  const [orderDiscountText, setOrderDiscountText] = useState('')
  const [discountNote, setDiscountNote] = useState('')
  const [scan, setScan] = useState('')
  const [category, setCategory] = useState('')
  const [sizeFor, setSizeFor] = useState(null)      // produk yang sedang dipilih size-nya
  const [editLine, setEditLine] = useState(null)    // skuId baris keranjang yang dibuka
  const [modal, setModal] = useState(null)          // 'pay' | 'done' | 'history' | 'settings' | 'close' | 'queue' | 'discount'
  const [lastOrder, setLastOrder] = useState(null)
  const [sync, setSync] = useState({ pending: 0, failed: 0, online: navigator.onLine })
  const [orders, setOrders] = useState({ queue: [], sent: [] })
  const [lastAdd, setLastAdd] = useState(null)      // { skuId, at } untuk sorotan di layar pelanggan
  const [payPreview, setPayPreview] = useState(null) // pilihan di layar bayar, dikirim ke layar pelanggan
  // tukar barang: barang yang dikembalikan dari struk asal { skuId, productId, code, name, variant, qty, credit }
  const [returns, setReturns] = useState([])
  const [exchangeOf, setExchangeOf] = useState(null) // { clientOrderId, orderNumber }
  const [held, setHeld] = useState([])              // keranjang yang ditahan (maks MAX_HELD)
  const scanRef = useRef(null)

  const refreshOrders = useCallback(async () => {
    const [queue, sent] = await Promise.all([allItems('queue'), allItems('sent')])
    const mine = (o) => String(o.eventId) === String(eventId)
    setOrders({ queue: queue.filter(mine), sent: sent.filter(mine) })
  }, [eventId])

  // ── Katalog: online -> simpan + unduh foto; offline -> pakai simpanan ────────
  const loadCatalog = useCallback(async (silent) => {
    try {
      const { data } = await posHttp.get(`/pos/events/${eventId}/catalog`)
      await setItem('kv', `catalog:${eventId}`, data)
      setCatalog(data); setCatalogError(null)
      setImgs(await loadCachedImages(data.items))
      cacheImages(data.items).then(setImgs)
      if (!silent) toast.success(`Katalog diperbarui (${data.items.length} SKU)`)
    } catch (err) {
      const cached = await getItem('kv', `catalog:${eventId}`)
      if (cached) {
        setCatalog(cached); setImgs(await loadCachedImages(cached.items))
        if (!silent) toast('Offline: memakai katalog tersimpan', { icon: '📦' })
      } else setCatalogError(err.response?.data?.message || 'Katalog belum tersimpan di laptop ini. Sambungkan internet sekali untuk mengunduh katalog.')
    }
  }, [eventId])

  useEffect(() => {
    if (!allowed) return
    deviceId().then(setDevice)
    getItem('kv', 'receiptSettings').then(s => s && setSettings(v => ({ ...v, ...s })))
    getItem('kv', `shift:${eventId}`).then(s => setShift(s || null))
    getItem('kv', `held:${eventId}`).then(h => setHeld(h || []))
    requestPersistence().finally(() => { loadCatalog(true); refreshOrders() })
    const stop = startAutoSync()
    const off = onSyncChange((st) => { setSync(st); refreshOrders() })
    syncState().then(setSync)
    const net = () => setSync(s => ({ ...s, online: navigator.onLine }))
    window.addEventListener('online', net); window.addEventListener('offline', net)
    return () => { stop(); off(); window.removeEventListener('online', net); window.removeEventListener('offline', net) }
  }, [allowed, eventId, loadCatalog, refreshOrders])

  // Peringatan sebelum menutup tab kalau masih ada transaksi belum terkirim
  useEffect(() => {
    const h = (e) => { if (sync.pending) { e.preventDefault(); e.returnValue = '' } }
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [sync.pending])

  const focusScan = useCallback(() => setTimeout(() => scanRef.current?.focus(), 0), [])
  useEffect(() => { if (!modal && !sizeFor) focusScan() }, [modal, sizeFor, focusScan])

  // ── Stok tampil = stok katalog - penjualan yang belum ada di server saat katalog dibuat ──
  const soldLocal = useMemo(() => {
    const m = {}
    const gen = catalog?.generatedAt || ''
    for (const o of [...orders.queue, ...orders.sent.filter(o => (o.sentAt || '') > gen)]) {
      for (const i of o.items) m[i.ProductSKUId] = (m[i.ProductSKUId] || 0) + i.qty
    }
    return m
  }, [orders, catalog])
  const skuById = useMemo(() => new Map((catalog?.items ?? []).map(i => [i.skuId, i])), [catalog])
  const byCode = useMemo(() => new Map((catalog?.items ?? []).map(i => [String(i.code).toLowerCase(), i])), [catalog])
  const inCart = (skuId) => cart.find(l => l.skuId === skuId)?.qty || 0
  const inReturns = (skuId) => returns.find(r => r.skuId === skuId)?.qty || 0
  const stockOf = (skuId) => (skuById.get(skuId)?.stock ?? 0) - (soldLocal[skuId] || 0) - inCart(skuId) + inReturns(skuId)

  // Produk = kumpulan SKU (size) dengan foto & nama yang sama
  const products = useMemo(() => {
    const map = new Map()
    for (const it of catalog?.items ?? []) {
      if (!map.has(it.productId)) map.set(it.productId, { productId: it.productId, name: it.name, imageUrl: it.imageUrl, category: it.category, price: it.price, skus: [] })
      map.get(it.productId).skus.push(it)
    }
    for (const p of map.values()) {
      p.skus.sort((a, b) => SIZE_ORDER.indexOf(a.variant) - SIZE_ORDER.indexOf(b.variant))
      p.price = Math.min(...p.skus.map(s => s.price))
    }
    return [...map.values()]
  }, [catalog])
  const categories = useMemo(() => [...new Set(products.map(p => p.category).filter(Boolean))].sort(), [products])

  // Filter grid: kategori + pencarian per kata ("tshirt queen m"); kata size dicocokkan ke size-nya
  const visible = useMemo(() => {
    const words = scan.trim().toLowerCase().split(/\s+/).filter(Boolean)
    return products.filter(p => {
      if (category && p.category !== category) return false
      if (!words.length) return true
      const hay = `${p.name} ${p.skus.map(s => s.code).join(' ')}`.toLowerCase()
      return words.every(w => SIZE_WORDS.has(w)
        ? p.skus.some(s => String(s.variant || '').toLowerCase() === w)
        : hay.includes(w))
    })
  }, [products, category, scan])

  // ── Keranjang ───────────────────────────────────────────────────────────
  // batas beli per orang dari pengaturan event (dihitung bersih: barang baru - barang yang dikembalikan)
  const limit = catalog?.event?.purchaseLimit
  const blockedByLimit = (productId, name) => {
    if (!isLimited(limit, productId) || (limitedNet(limit, cart, returns)[productId] || 0) + 1 <= limit.qty) return false
    toast.error(`Batas beli: maks ${limit.qty} pcs ${shortName(name)} per orang`)
    return true
  }
  const addSku = (it) => {
    if (blockedByLimit(it.productId, it.name)) return
    if (stockOf(it.skuId) <= 0) toast(`Stok sistem ${it.code} habis — tetap dijual & ditandai untuk dicek.`, { icon: '⚠️' })
    setLastAdd({ skuId: it.skuId, at: Date.now() })
    setCart(c => {
      const ex = c.find(l => l.skuId === it.skuId)
      if (ex) return c.map(l => l.skuId === it.skuId ? { ...l, qty: l.qty + 1 } : l)
      return [...c, { skuId: it.skuId, productId: it.productId, code: it.code, name: it.name, variant: it.variant, listPrice: it.price, unitPrice: it.price, qty: 1, discountText: '' }]
    })
  }
  const pickProduct = (p) => {
    if (p.skus.length === 1) { addSku(p.skus[0]); focusScan() } else setSizeFor(p)
  }
  const onScanEnter = () => {
    const q = scan.trim()
    if (!q) { if (hasItems) setModal('pay'); return }
    const hit = byCode.get(q.toLowerCase())
    if (hit) { addSku(hit); setScan(''); return }
    if (visible.length === 1) { pickProduct(visible[0]); setScan(''); return }
    if (!visible.length) { toast.error(`"${q}" tidak ada di katalog`); setScan('') }
  }
  const updateLine = (skuId, patch) => setCart(c => c.map(l => l.skuId === skuId ? { ...l, ...patch } : l))
  const removeLine = (skuId) => setCart(c => c.filter(l => l.skuId !== skuId))
  const clearCart = () => { setCart([]); setOrderDiscountText(''); setDiscountNote(''); setEditLine(null); setReturns([]); setExchangeOf(null) }
  const hasItems = cart.length > 0 || returns.length > 0

  // ── Tukar: struk asal dipilih di modal, barang kembali masuk keranjang sebagai potongan ──
  const startExchange = (order, picks) => {
    setExchangeOf({ clientOrderId: order.clientOrderId, orderNumber: order.orderNumber })
    setReturns(picks)
    setModal(null); focusScan()
    toast.success('Scan barang pengganti')
  }

  const totals = useMemo(() => {
    const lines = cart.map(l => {
      const gross = l.qty * l.unitPrice
      const discount = parseDiscount(l.discountText, gross)
      return { ...l, gross, discount, lineTotal: gross - discount }
    })
    const subtotal = lines.reduce((s, l) => s + l.gross, 0)
    const itemDiscount = lines.reduce((s, l) => s + l.discount, 0)
    const orderDiscount = parseDiscount(orderDiscountText, subtotal - itemDiscount)
    const returnTotal = returns.reduce((s, r) => s + r.qty * r.credit, 0)
    return {
      lines, returns, subtotal, itemDiscount, orderDiscount, returnTotal,
      total: subtotal - itemDiscount - orderDiscount - returnTotal, pcs: lines.reduce((s, l) => s + l.qty, 0),
    }
  }, [cart, returns, orderDiscountText])

  // ── Tahan keranjang: pembeli masih mencoba / ambil size lain, kasir lanjut melayani yang lain ──
  const saveHeld = useCallback((list) => { setHeld(list); setItem('kv', `held:${eventId}`, list) }, [eventId])
  const snapshot = useCallback(() => ({
    id: Date.now(), at: new Date().toISOString(), cart, returns, exchangeOf, orderDiscountText, discountNote, pcs: totals.pcs, total: totals.total,
  }), [cart, returns, exchangeOf, orderDiscountText, discountNote, totals])
  const holdCart = useCallback(() => {
    if (!cart.length && !returns.length) return
    if (held.length >= MAX_HELD) { toast.error(`Maksimal ${MAX_HELD} keranjang ditahan — lanjutkan salah satu dulu`); return }
    saveHeld([...held, snapshot()])
    clearCart(); setLastAdd(null); focusScan()
    toast.success('Keranjang ditahan')
  }, [cart.length, returns.length, held, saveHeld, snapshot, focusScan])
  const resumeHeld = (h) => {
    // keranjang yang sedang aktif ditukar posisinya dengan yang dilanjutkan
    saveHeld([...held.filter(x => x.id !== h.id), ...(hasItems ? [snapshot()] : [])])
    setCart(h.cart); setReturns(h.returns || []); setExchangeOf(h.exchangeOf || null)
    setOrderDiscountText(h.orderDiscountText || ''); setDiscountNote(h.discountNote || ''); setEditLine(null)
    focusScan()
  }
  const dropHeld = (h) => saveHeld(held.filter(x => x.id !== h.id))

  // ── Layar pelanggan: kirim keadaan terbaru ke jendela kedua ──────────────
  useEffect(() => {
    if (!catalog) return
    if (modal === 'done' && lastOrder) {
      publishDisplay(eventId, { phase: 'done', done: {
        customerName: lastOrder.customerName, total: lastOrder.total, change: lastOrder.change,
        fulfillment: lastOrder.fulfillment, pickupCode: lastOrder.pickupCode,
        exchange: !!lastOrder.exchangeOfNumber, refund: lastOrder.total < 0 ? -lastOrder.total : 0,
      } })
      return
    }
    if (!cart.length && !returns.length) { publishDisplay(eventId, { phase: 'idle' }); return }
    publishDisplay(eventId, {
      phase: modal === 'pay' ? 'pay' : 'cart',
      lines: totals.lines.map(l => ({ skuId: l.skuId, productId: l.productId, name: l.name, variant: l.variant, qty: l.qty, unitPrice: l.unitPrice, discount: l.discount, lineTotal: l.lineTotal })),
      returns: totals.returns.map(r => ({ skuId: r.skuId, productId: r.productId, name: r.name, variant: r.variant, qty: r.qty, credit: r.credit })),
      returnTotal: totals.returnTotal,
      subtotal: totals.subtotal, discount: totals.itemDiscount + totals.orderDiscount, total: totals.total, pcs: totals.pcs,
      lastSku: lastAdd?.skuId, lastAt: lastAdd?.at,
      pay: modal === 'pay' ? payPreview || { methods: ['CASH'], fulfillment: 'NOW' } : null,
    })
  }, [catalog, eventId, cart.length, returns.length, totals, modal, lastOrder, lastAdd, payPreview])

  const openDisplay = async () => {
    if (!(await openDisplayWindow(eventId))) toast.error('Jendela diblokir browser — izinkan pop-up untuk situs ini')
  }
  // layar eksternal / iPad baru dicolok -> tawarkan buka layar pelanggan di sana
  useEffect(() => onScreensChange((extended) => {
    if (extended) toast((t) => (
      <span className="flex items-center gap-3">Layar kedua terdeteksi
        <button className="btn-primary text-xs" onClick={() => { toast.dismiss(t.id); openDisplay() }}>Buka layar pelanggan</button>
      </span>
    ), { duration: 15000, icon: '🖥️' })
  }), []) // eslint-disable-line react-hooks/exhaustive-deps

  const printOrder = (order, copies) => printReceipt(orderPrintHtml(order, { event: catalog?.event, settings, cashierName: user?.name }, copies))

  // ── Bayar ───────────────────────────────────────────────────────────────
  const finishOrder = async ({ payments, cashReceived, customerName, customerPhone, fulfillment }) => {
    const seq = await nextSeq(eventId)
    const order = {
      clientOrderId: `${device}-${eventId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      orderNumber: `E${eventId}-${device}-${String(seq).padStart(4, '0')}`,
      // nomor ambil pendek untuk dipanggil/dicari: 2 huruf laptop + urutan
      pickupCode: fulfillment === 'LATER' ? `${device.slice(-2)}-${String(seq).padStart(3, '0')}` : null,
      eventId: Number(eventId), shiftId: shift?.id ?? null,
      soldAt: new Date().toISOString(),
      items: [
        ...totals.lines.map(l => ({ ProductSKUId: l.skuId, productId: l.productId, qty: l.qty, unitPrice: l.unitPrice, discount: l.discount, name: l.name, variant: l.variant })),
        // barang dikembalikan: qty negatif, nilainya dihitung ulang server dari struk asal
        ...totals.returns.map(r => ({ ProductSKUId: r.skuId, productId: r.productId, qty: -r.qty, unitPrice: r.credit, discount: 0, name: r.name, variant: r.variant })),
      ],
      subtotal: totals.subtotal, itemDiscount: totals.itemDiscount, orderDiscount: totals.orderDiscount, returnTotal: totals.returnTotal, total: totals.total,
      exchangeOfClientId: exchangeOf?.clientOrderId || null, exchangeOfNumber: exchangeOf?.orderNumber || null,
      discountNote: discountNote || null,
      customerName: customerName || null, customerPhone: customerPhone || null, fulfillment,
      payments, cashReceived,
      change: cashReceived != null ? cashReceived - payments.filter(p => p.method === 'CASH').reduce((s, p) => s + p.amount, 0) : 0,
    }
    await enqueueOrder(order)
    if (settings.autoPrint) printOrder(order)
    clearCart(); setPayPreview(null); setLastOrder(order); setModal('done')
    refreshOrders()
  }

  // Batas beli per No. HP: gabungan transaksi di laptop ini (server ikut menandai transaksi dari laptop lain)
  const checkLimit = (phone) => {
    if (!limit?.qty) return null
    const net = limitedNet(limit, cart, returns)
    const names = Object.fromEntries(cart.map(l => [l.productId, l.name]))
    if (limit.perPhone && Object.keys(net).length) {
      const p = digits(phone)
      if (!p) return 'Isi No. HP — produk ini dibatasi per orang'
      for (const o of [...orders.queue, ...orders.sent]) {
        if (digits(o.customerPhone) !== p) continue
        for (const i of o.items) {
          const pid = i.productId ?? skuById.get(i.ProductSKUId)?.productId
          if (net[pid] != null) net[pid] += i.qty
        }
      }
    }
    const over = Object.entries(net).find(([, q]) => q > limit.qty)
    return over ? `${shortName(names[over[0]])}: sudah ${over[1]} pcs untuk No. HP ini (maks ${limit.qty})` : null
  }

  // Shortcut: F2 = bayar, F4 = tahan keranjang, Esc = tutup. Ketikan/scan saat tidak ada kolom aktif diarahkan ke kolom scan.
  useEffect(() => {
    const h = (e) => {
      if (e.key === 'F2' && hasItems && !modal) { e.preventDefault(); setModal('pay') }
      if (e.key === 'F4' && hasItems && !modal) { e.preventDefault(); holdCart() }
      if (e.key === 'Escape' && (modal || sizeFor)) { if (modal !== 'done') setModal(null); setSizeFor(null) }
      if (e.key === 'Enter' && modal === 'done') { e.preventDefault(); setModal(null) }
      const tag = document.activeElement?.tagName
      if (!modal && !sizeFor && e.key.length === 1 && !e.metaKey && !e.ctrlKey && !['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) scanRef.current?.focus()
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [hasItems, modal, sizeFor, holdCart])

  const back = () => navigate('/pos')
  if (!allowed) return <NoPermission page="Kasir" />
  if (catalogError) return (
    <Screen onBack={back}>
      <div className="max-w-md mx-auto mt-24 bg-white rounded-2xl p-8 text-center space-y-4 shadow-sm">
        <WifiOff className="mx-auto text-slate-400" size={32} />
        <p className="text-slate-700">{catalogError}</p>
        <button className="btn-primary mx-auto" onClick={() => loadCatalog()}><RefreshCw size={14} />Coba lagi</button>
      </div>
    </Screen>
  )
  if (!catalog || shift === undefined) return <Screen onBack={back}><p className="p-10 text-slate-400">Memuat kasir…</p></Screen>
  if (!shift) return (
    <Screen onBack={back} title={catalog.event.name}>
      <OpenShift eventId={eventId} device={device} userName={user?.name} onOpened={async (s) => { await setItem('kv', `shift:${eventId}`, s); setShift(s) }} />
    </Screen>
  )

  const recent = [...orders.queue.map(o => ({ ...o, pending: true })), ...orders.sent].sort((a, b) => b.soldAt.localeCompare(a.soldAt))

  return (
    <Screen onBack={back} title={catalog.event.name}
      right={<>
        <SyncBadge sync={sync} onClick={() => sync.failed ? setModal('queue') : syncQueue()} />
        <IconBtn icon={RefreshCw} label="Perbarui katalog & stok" onClick={() => loadCatalog()} />
        <IconBtn icon={Monitor} label="Buka layar pelanggan (monitor / iPad)" onClick={openDisplay} text="Layar pelanggan" />
        <IconBtn icon={ArrowLeftRight} label="Tukar barang (scan struk asal)" onClick={() => setModal('exchange')} text="Tukar" />
        <IconBtn icon={History} label="Riwayat" onClick={() => setModal('history')} text="Riwayat" />
        <IconBtn icon={Settings} label="Pengaturan struk" onClick={() => setModal('settings')} />
        <IconBtn icon={LogOut} label="Tutup shift" onClick={() => setModal('close')} text="Tutup shift" />
      </>}>
      <div className="flex h-[calc(100vh-60px)]">
        {/* ── kiri: cari + grid produk ── */}
        <div className="flex-1 min-w-0 flex flex-col">
          <div className="px-5 pt-4 pb-3 space-y-3">
            <div className="relative">
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input ref={scanRef} value={scan} onChange={e => setScan(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); onScanEnter() } else if (e.key === 'Escape' && scan) { e.stopPropagation(); setScan('') } }}
                className="w-full h-12 pl-11 pr-28 rounded-xl bg-white border border-slate-200 text-[15px] shadow-sm focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand"
                placeholder="Scan barcode atau cari produk / size…" autoFocus />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 inline-flex items-center gap-1 text-[11px] text-slate-400"><ScanLine size={13} />siap scan</span>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {['', ...categories].map(c => (
                <button key={c || 'all'} onClick={() => setCategory(c)}
                  className={`shrink-0 px-3.5 py-1.5 rounded-full text-[13px] font-semibold border transition-colors ${category === c ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'}`}>
                  {c || 'Semua'}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-5 pb-5">
            {!visible.length ? <p className="text-center text-slate-400 mt-16">Tidak ada produk yang cocok dengan "{scan}"</p> : (
              <div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(168px,1fr))]">
                {visible.map(p => {
                  const stock = p.skus.reduce((s, k) => s + Math.max(stockOf(k.skuId), 0), 0)
                  return (
                    <button key={p.productId} onClick={() => pickProduct(p)}
                      className="group text-left bg-white rounded-2xl border border-slate-200 overflow-hidden hover:border-slate-400 hover:shadow-md active:scale-[.98] transition-all">
                      <div className="relative aspect-square bg-slate-100">
                        {imgs[p.productId]
                          ? <img src={imgs[p.productId]} alt="" className="w-full h-full object-cover" />
                          : <div className="w-full h-full flex items-center justify-center p-3 text-center text-lg font-black tracking-wide text-slate-300 uppercase break-words">{lineName(p.name)}</div>}
                        {stock <= 0 && <span className="absolute inset-0 bg-white/70 flex items-center justify-center text-xs font-bold text-slate-600 tracking-widest">STOK HABIS</span>}
                        {p.skus.length > 1 && (
                          <span className="absolute bottom-2 left-2 right-2 flex flex-wrap gap-1">
                            {p.skus.map(k => (
                              <span key={k.skuId} className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${stockOf(k.skuId) > 0 ? 'bg-white/90 text-slate-800' : 'bg-white/60 text-slate-400 line-through'}`}>{k.variant}</span>
                            ))}
                          </span>
                        )}
                      </div>
                      <div className="p-3">
                        <p className="text-[13px] font-semibold text-slate-800 leading-snug line-clamp-2 min-h-[2.4em]">{shortName(p.name)}</p>
                        <div className="flex items-baseline justify-between mt-1.5">
                          <span className="text-[14px] font-bold text-slate-900">{rp(p.price)}</span>
                          <span className="text-[11px] text-slate-400">stok {stock}</span>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── kanan: pesanan ── */}
        <aside className="w-[400px] shrink-0 bg-white border-l border-slate-200 flex flex-col">
          <div className="px-5 py-4 flex items-center justify-between border-b border-slate-100">
            <div>
              <p className="font-bold text-slate-900">Pesanan</p>
              <p className="text-xs text-slate-400">{totals.pcs} item · {cart.length} produk</p>
            </div>
            {hasItems && (
              <div className="flex items-center gap-3">
                <button className="text-xs font-semibold text-slate-600 hover:text-slate-900 inline-flex items-center gap-1" onClick={holdCart} title="Tahan keranjang (F4)"><PauseCircle size={13} />Tahan</button>
                <button className="text-xs font-semibold text-slate-400 hover:text-danger" onClick={clearCart}>Kosongkan</button>
              </div>
            )}
          </div>
          {!!held.length && (
            <div className="px-3 py-2 border-b border-slate-100 bg-amber-50/60 flex gap-1.5 overflow-x-auto">
              {held.map((h, i) => (
                <div key={h.id} className="shrink-0 flex items-center rounded-lg border border-amber-200 bg-white text-xs">
                  <button className="pl-2.5 pr-1.5 py-1.5 text-left" onClick={() => resumeHeld(h)}
                    title={h.cart.map(l => `${l.qty}× ${shortName(l.name)} ${l.variant || ''}`).join('\n')}>
                    <span className="font-bold text-slate-800">Ditahan {i + 1}</span>
                    <span className="text-slate-500"> · {h.pcs} pcs · {new Date(h.at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>
                  </button>
                  <button className="px-1.5 text-slate-300 hover:text-danger" title="Hapus keranjang ditahan" onClick={() => dropHeld(h)}><X size={12} /></button>
                </div>
              ))}
            </div>
          )}
          {exchangeOf && (
            <div className="px-5 py-2.5 border-b border-slate-100 bg-sky-50 flex items-center justify-between text-xs">
              <span className="text-sky-800"><ArrowLeftRight size={12} className="inline mr-1" />Tukar dari struk <b>{exchangeOf.orderNumber}</b></span>
              <button className="font-semibold text-slate-400 hover:text-danger" onClick={() => { setReturns([]); setExchangeOf(null) }}>Batal tukar</button>
            </div>
          )}

          <div className="flex-1 overflow-y-auto">
            {returns.map(r => (
              <div key={`ret-${r.skuId}`} className="px-5 py-3 border-b border-slate-100 bg-sky-50/40 flex gap-3 items-center">
                <div className="w-12 h-12 rounded-lg bg-slate-100 overflow-hidden shrink-0 flex items-center justify-center text-xs font-black text-slate-300 opacity-60">
                  {imgs[r.productId] ? <img src={imgs[r.productId]} alt="" className="w-full h-full object-cover" /> : initials(r.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-bold tracking-wide text-sky-700"><Undo2 size={11} className="inline mr-0.5" />DIKEMBALIKAN</p>
                  <p className="text-[13px] font-semibold text-slate-800 truncate">{shortName(r.name)}</p>
                  <p className="text-xs text-slate-500">{r.variant && <span className="inline-block px-1.5 rounded border border-slate-300 font-bold text-slate-700 mr-1.5">{r.variant}</span>}{r.qty} × {rp(r.credit)}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-sky-700">-{rp(r.qty * r.credit)}</p>
                  <button className="text-[11px] text-slate-400 hover:text-danger" onClick={() => setReturns(rs => rs.filter(x => x.skuId !== r.skuId))}>hapus</button>
                </div>
              </div>
            ))}
            {!cart.length ? (
              <div className={`${returns.length ? 'py-10' : 'h-full'} flex flex-col items-center justify-center text-center px-8 text-slate-400`}>
                <ShoppingBag size={36} className="mb-3 text-slate-300" />
                <p className="font-semibold text-slate-500">{returns.length ? 'Scan barang pengganti' : 'Belum ada barang'}</p>
                <p className="text-sm">{returns.length ? 'Atau langsung selesaikan kalau barang hanya dikembalikan.' : 'Scan barcode atau klik produk di kiri.'}</p>
              </div>
            ) : totals.lines.map(l => (
              <div key={l.skuId} className="px-5 py-3 border-b border-slate-100">
                <div className="flex gap-3">
                  <div className="w-12 h-12 rounded-lg bg-slate-100 overflow-hidden shrink-0 flex items-center justify-center text-xs font-black text-slate-300">
                    {imgs[l.productId] ? <img src={imgs[l.productId]} alt="" className="w-full h-full object-cover" /> : initials(l.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <button className="block text-left w-full" onClick={() => setEditLine(editLine === l.skuId ? null : l.skuId)}>
                      <p className="text-[13px] font-semibold text-slate-800 truncate">{shortName(l.name)}</p>
                      <p className="text-xs text-slate-500">
                        {l.variant && <span className="inline-block px-1.5 rounded border border-slate-300 font-bold text-slate-700 mr-1.5">{l.variant}</span>}
                        {rp(l.unitPrice)}{l.unitPrice !== l.listPrice && <span className="text-amber-600"> (normal {rp(l.listPrice)})</span>}
                        {l.discount > 0 && <span className="text-emerald-600"> · diskon {rp(l.discount)}</span>}
                      </p>
                    </button>
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center rounded-lg border border-slate-200">
                        <button className="w-8 h-8 flex items-center justify-center text-slate-500 hover:bg-slate-50" onClick={() => l.qty > 1 ? updateLine(l.skuId, { qty: l.qty - 1 }) : removeLine(l.skuId)}>{l.qty > 1 ? <Minus size={14} /> : <Trash2 size={14} />}</button>
                        <span className="w-8 text-center font-bold text-sm">{l.qty}</span>
                        <button className="w-8 h-8 flex items-center justify-center text-slate-500 hover:bg-slate-50" onClick={() => !blockedByLimit(l.productId, l.name) && updateLine(l.skuId, { qty: l.qty + 1 })}><Plus size={14} /></button>
                      </div>
                      <span className="font-bold text-slate-900">{rp(l.lineTotal)}</span>
                    </div>
                    {editLine === l.skuId && (
                      <div className="grid grid-cols-2 gap-2 mt-3 p-2.5 rounded-lg bg-slate-50">
                        <label className="text-[11px] text-slate-500">Harga satuan
                          <input className="input mt-1 py-1.5 text-right" value={l.unitPrice.toLocaleString('id-ID')} onChange={e => updateLine(l.skuId, { unitPrice: num(e.target.value) })} /></label>
                        <label className="text-[11px] text-slate-500">Diskon (Rp / %)
                          <input className="input mt-1 py-1.5 text-right" value={l.discountText} placeholder="0" onChange={e => updateLine(l.skuId, { discountText: e.target.value })} /></label>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-slate-200 px-5 py-4 space-y-2 bg-slate-50/60">
            <Line label="Subtotal" value={rp(totals.subtotal)} />
            {totals.itemDiscount > 0 && <Line label="Diskon item" value={`-${rp(totals.itemDiscount)}`} />}
            {totals.orderDiscount > 0
              ? <Line label={<button className="underline decoration-dotted" onClick={() => setModal('discount')}>Diskon transaksi</button>} value={`-${rp(totals.orderDiscount)}`} />
              : <button disabled={!cart.length} onClick={() => setModal('discount')} className="text-xs font-semibold text-brand inline-flex items-center gap-1 disabled:opacity-40"><Tag size={12} />Tambah diskon transaksi</button>}
            {totals.returnTotal > 0 && <Line label="Barang dikembalikan" value={`-${rp(totals.returnTotal)}`} />}
            {limit?.qty > 0 && <p className="text-[11px] text-slate-400">Batas beli: maks {limit.qty} pcs per artikel{limit.productIds?.length ? ' (produk tertentu)' : ''}{limit.perPhone ? ' · per No. HP' : ''}</p>}
            <div className="flex items-end justify-between pt-2">
              <span className="text-sm font-semibold text-slate-500">{totals.total < 0 ? 'Uang dikembalikan' : 'Total'}</span>
              <span className="text-3xl font-black tracking-tight text-slate-900">{rp(Math.abs(totals.total))}</span>
            </div>
            <button className="w-full h-14 rounded-xl bg-brand text-white text-lg font-bold shadow-sm hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed"
              disabled={!hasItems} onClick={() => setModal('pay')}>{exchangeOf ? (totals.total > 0 ? 'Bayar selisih' : 'Selesaikan tukar') : 'Bayar'} <span className="text-sm font-medium opacity-70">(F2)</span></button>
            <p className="text-[11px] text-slate-400 text-center">Laptop {device} · shift #{shift.id} · {user?.name}</p>
          </div>
        </aside>
      </div>

      {sizeFor && <SizePicker product={sizeFor} img={imgs[sizeFor.productId]} stockOf={stockOf} onClose={() => setSizeFor(null)}
        onPick={(sku) => { addSku(sku); setSizeFor(null) }} />}
      {modal === 'discount' && (
        <Modal open onClose={() => setModal(null)} title="Diskon transaksi" size="sm">
          <div className="space-y-3">
            <div className="flex gap-2">{['5%', '10%', '15%', '20%'].map(v => <button key={v} className="btn-secondary flex-1 justify-center" onClick={() => setOrderDiscountText(v)}>{v}</button>)}</div>
            <label className="label">Nominal (Rp) atau persen</label>
            <input className="input" autoFocus value={orderDiscountText} onChange={e => setOrderDiscountText(e.target.value)} placeholder="mis. 10% atau 50000" />
            <label className="label">Alasan (opsional)</label>
            <input className="input" value={discountNote} onChange={e => setDiscountNote(e.target.value)} placeholder="mis. promo bundling" />
            <div className="flex gap-2 pt-1">
              <button className="btn-secondary flex-1 justify-center" onClick={() => { setOrderDiscountText(''); setDiscountNote(''); setModal(null) }}>Hapus diskon</button>
              <button className="btn-primary flex-1 justify-center" onClick={() => setModal(null)}>Pakai</button>
            </div>
          </div>
        </Modal>
      )}
      {modal === 'pay' && <PayScreen totals={totals} exchange={!!exchangeOf} checkLimit={checkLimit} onClose={() => { setModal(null); setPayPreview(null) }} onPay={finishOrder} onPreview={setPayPreview} />}
      {modal === 'exchange' && <ExchangeModal eventId={eventId} orders={orders} online={sync.online} skuById={skuById} onClose={() => setModal(null)} onStart={startExchange} />}
      {modal === 'done' && lastOrder && <DoneScreen order={lastOrder} onPrint={(c) => printOrder(lastOrder, c)} onNew={() => setModal(null)} />}
      {modal === 'history' && (
        <Modal open onClose={() => setModal(null)} title="Riwayat transaksi laptop ini" size="lg">
          <p className="text-xs text-slate-400 mb-2">Riwayat lengkap semua kasir & antrean pengambilan ada di modul POS → Riwayat Transaksi.</p>
          <div className="max-h-[60vh] overflow-auto divide-y divide-slate-100 text-sm">
            {!recent.length && <p className="text-slate-400 p-4">Belum ada transaksi.</p>}
            {recent.slice(0, 100).map(o => (
              <div key={o.clientOrderId} className="flex items-center justify-between py-2.5 gap-3">
                <div className="min-w-0">
                  <p className="font-semibold">{o.orderNumber}
                    <span className="text-xs font-normal text-slate-400"> · {new Date(o.soldAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}{o.customerName ? ` · ${o.customerName}` : ''}</span>
                    {o.fulfillment === 'LATER' && <span className="ml-2 badge-amber">ambil nanti {o.pickupCode}</span>}
                    {o.exchangeOfNumber && <span className="ml-2 text-[11px] font-semibold text-sky-700">tukar dari {o.exchangeOfNumber}</span>}
                  </p>
                  <p className="text-xs text-slate-500 truncate">{o.items.map(i => `${i.qty}× ${shortName(i.name)}${i.variant ? ` ${i.variant}` : ''}`).join(', ')}</p>
                  {o.error && <p className="text-xs text-danger">Ditolak: {o.error}</p>}
                </div>
                <div className="text-right shrink-0">
                  <p className="font-semibold">{rp(o.total)}</p>
                  <p className={`text-[11px] ${o.pending ? 'text-amber-600' : 'text-emerald-600'}`}>{o.pending ? 'belum terkirim' : 'terkirim'}</p>
                  <button className="text-xs text-brand inline-flex items-center gap-1" onClick={() => printOrder(o)}><Printer size={11} />Cetak ulang</button>
                </div>
              </div>
            ))}
          </div>
        </Modal>
      )}
      {modal === 'queue' && (
        <Modal open onClose={() => setModal(null)} title="Transaksi ditolak server" size="lg">
          <p className="text-sm text-slate-500 mb-3">Transaksi ini tetap tersimpan di laptop. Biasanya karena data tidak valid (mis. event belum dibuka). Perbaiki di server lalu klik Kirim ulang.</p>
          <div className="divide-y divide-slate-100 text-sm max-h-[50vh] overflow-auto">
            {orders.queue.filter(o => o.error).map(o => (
              <div key={o.clientOrderId} className="py-2 flex justify-between gap-3">
                <div><p className="font-semibold">{o.orderNumber} · {rp(o.total)}</p><p className="text-xs text-danger">{o.error}</p></div>
                <RemoveQueued order={o} onRemoved={async () => { await delItem('queue', o.clientOrderId); setSync(await syncState()); refreshOrders() }} />
              </div>
            ))}
          </div>
          <button className="btn-primary mt-4" onClick={() => syncQueue()}><RefreshCw size={14} />Kirim ulang</button>
        </Modal>
      )}
      {modal === 'settings' && (
        <SettingsModal settings={settings} event={catalog.event} userName={user?.name} onClose={() => setModal(null)}
          onSave={async (s) => { await setItem('kv', 'receiptSettings', s); setSettings(s); setModal(null) }} />
      )}
      {modal === 'close' && (
        <CloseShift shift={shift} sync={sync} held={held.length} onClose={() => setModal(null)}
          onClosed={async () => { await delItem('kv', `shift:${eventId}`); setShift(null); setModal(null) }} />
      )}
    </Screen>
  )
}

// ── Komponen ────────────────────────────────────────────────────────────────
function Screen({ children, onBack, title, right }) {
  return (
    <div className="min-h-screen bg-[#F4F3F0]">
      <div className="h-[60px] bg-white border-b border-slate-200 flex items-center gap-3 px-5">
        <button className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100" onClick={onBack} title="Kembali ke POS"><ArrowLeft size={18} /></button>
        <div className="w-8 h-8 rounded-lg bg-brand text-white flex items-center justify-center"><Store size={16} /></div>
        <div className="leading-tight min-w-0">
          <p className="font-bold text-slate-900 truncate">{title || 'Kasir'}</p>
          <p className="text-[11px] text-slate-400">Kasir Preface</p>
        </div>
        <div className="ml-auto flex items-center gap-1.5">{right}</div>
      </div>
      {children}
    </div>
  )
}

function IconBtn({ icon, label, onClick, text }) {
  const Icon = icon
  return (
    <button onClick={onClick} title={label} className="h-9 px-2.5 rounded-lg inline-flex items-center gap-1.5 text-[13px] font-semibold text-slate-600 hover:bg-slate-100">
      <Icon size={16} />{text && <span className="hidden xl:inline">{text}</span>}
    </button>
  )
}

const Line = ({ label, value }) => <div className="flex justify-between text-sm"><span className="text-slate-500">{label}</span><span className="font-semibold text-slate-700">{value}</span></div>

function SyncBadge({ sync, onClick }) {
  const off = !sync.online
  const cls = sync.failed ? 'bg-red-50 text-danger border-red-200' : off || sync.pending ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
  const text = sync.failed ? `${sync.failed} ditolak` : off ? `Offline · ${sync.pending} menunggu` : sync.pending ? `${sync.pending} menunggu` : 'Online'
  return (
    <button onClick={onClick} className={`h-9 text-xs font-semibold px-3 rounded-lg border inline-flex items-center gap-1.5 mr-1 ${cls}`} title="Status kirim transaksi — klik untuk kirim sekarang">
      {off ? <WifiOff size={14} /> : <Wifi size={14} />}{text}
    </button>
  )
}

function SizePicker({ product, img, stockOf, onPick, onClose }) {
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex gap-4 p-5 border-b border-slate-100">
          <div className="w-20 h-20 rounded-xl bg-slate-100 overflow-hidden shrink-0 flex items-center justify-center text-xl font-black text-slate-300">
            {img ? <img src={img} alt="" className="w-full h-full object-cover" /> : initials(product.name)}
          </div>
          <div className="min-w-0">
            <p className="font-bold text-slate-900 leading-snug">{shortName(product.name)}</p>
            <p className="text-sm text-slate-500 mt-1">{rp(product.price)}</p>
            <p className="text-xs text-slate-400 mt-2">Pilih size</p>
          </div>
          <button className="ml-auto self-start text-slate-400" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="grid grid-cols-3 gap-3 p-5">
          {product.skus.map(k => {
            const st = stockOf(k.skuId)
            return (
              <button key={k.skuId} onClick={() => onPick(k)} autoFocus={st > 0}
                className={`h-20 rounded-xl border-2 flex flex-col items-center justify-center transition-colors ${st > 0 ? 'border-slate-200 hover:border-slate-900 hover:bg-slate-50' : 'border-dashed border-slate-200 text-slate-400'}`}>
                <span className="text-2xl font-black">{k.variant || '—'}</span>
                <span className={`text-[11px] ${st > 0 ? 'text-slate-500' : 'text-danger'}`}>{st > 0 ? `stok ${st}` : 'stok habis'}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function PayScreen({ totals, exchange, checkLimit, onClose, onPay, onPreview }) {
  const total = totals.total
  // tukar tanpa selisih / barang baru lebih murah: tidak ada pembayaran, selisih dikembalikan tunai
  const noPay = total <= 0
  const [method, setMethod] = useState('CASH')
  const [split, setSplit] = useState(null)              // null = 1 metode; [{method, amount}] = bayar campur
  const [received, setReceived] = useState('')
  const [customer, setCustomer] = useState({ name: '', phone: '' })
  const [fulfillment, setFulfillment] = useState('NOW')
  const [busy, setBusy] = useState(false)

  const rows = noPay ? [{ method: 'CASH', amount: total }] : split || [{ method, amount: total }]
  const paid = rows.reduce((s, r) => s + (Number(r.amount) || 0), 0)
  const cashPart = noPay ? 0 : rows.filter(r => r.method === 'CASH').reduce((s, r) => s + (Number(r.amount) || 0), 0)
  const recv = received === '' ? cashPart : num(received)
  const change = recv - cashPart
  // total 0 (diskon 100%) boleh tanpa pembayaran
  const limitErr = checkLimit?.(customer.phone)
  const valid = paid === total && (!cashPart || recv >= cashPart) && !limitErr
  const submit = async () => {
    if (!valid || busy) return
    setBusy(true)
    await onPay({
      payments: total < 0 ? [{ method: 'CASH', amount: total }] : rows.filter(r => Number(r.amount) > 0).map(r => ({ method: r.method, amount: Number(r.amount) })),
      cashReceived: cashPart ? recv : null,
      customerName: customer.name.trim(), customerPhone: customer.phone.trim(), fulfillment,
    })
  }
  useEffect(() => {
    onPreview?.({ methods: noPay ? [] : [...new Set(rows.filter(r => Number(r.amount) > 0).map(r => r.method))], fulfillment, cashReceived: cashPart ? recv : 0, change: cashPart ? change : 0 })
  }, [method, split, received, fulfillment, total]) // eslint-disable-line react-hooks/exhaustive-deps
  const setRow = (i, patch) => setSplit(rs => rs.map((r, j) => j === i ? { ...r, ...patch } : r))

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-6" onKeyDown={e => { if (e.key === 'Enter' && e.target.tagName !== 'BUTTON') { e.preventDefault(); submit() } }}>
      <div className="bg-white rounded-3xl w-full max-w-4xl h-[min(720px,92vh)] overflow-hidden shadow-2xl flex">
        {/* ringkasan */}
        <div className="w-[300px] shrink-0 bg-slate-50 border-r border-slate-100 p-6 flex flex-col">
          <p className="text-xs font-bold tracking-[.2em] text-slate-400">RINGKASAN</p>
          <div className="flex-1 overflow-y-auto mt-3 space-y-2.5">
            {totals.lines.map(l => (
              <div key={l.skuId} className="flex justify-between gap-2 text-sm">
                <span className="text-slate-600 min-w-0"><b className="text-slate-800">{l.qty}×</b> {shortName(l.name)} {l.variant && <span className="text-slate-400">{l.variant}</span>}</span>
                <span className="font-semibold shrink-0">{(l.lineTotal).toLocaleString('id-ID')}</span>
              </div>
            ))}
            {totals.returns.map(r => (
              <div key={`ret-${r.skuId}`} className="flex justify-between gap-2 text-sm text-sky-700">
                <span className="min-w-0"><b>{r.qty}×</b> {shortName(r.name)} {r.variant} <span className="text-[11px] font-bold">KEMBALI</span></span>
                <span className="font-semibold shrink-0">-{(r.qty * r.credit).toLocaleString('id-ID')}</span>
              </div>
            ))}
          </div>
          <div className="border-t border-slate-200 pt-3 space-y-1 text-sm">
            <Line label="Subtotal" value={rp(totals.subtotal)} />
            {(totals.itemDiscount + totals.orderDiscount) > 0 && <Line label="Diskon" value={`-${rp(totals.itemDiscount + totals.orderDiscount)}`} />}
            {totals.returnTotal > 0 && <Line label="Barang dikembalikan" value={`-${rp(totals.returnTotal)}`} />}
          </div>
        </div>

        {/* pembayaran */}
        <div className="flex-1 min-w-0 flex flex-col">
        <div className="flex-1 p-7 overflow-y-auto space-y-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-slate-500">{total < 0 ? 'Uang dikembalikan ke pembeli' : exchange ? 'Selisih bayar' : 'Total bayar'}</p>
              <p className="text-5xl font-black tracking-tight text-slate-900">{rp(Math.abs(total))}</p>
            </div>
            <button className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100" onClick={onClose}><X size={18} /></button>
          </div>

          {noPay ? (
            <div className={`rounded-2xl p-4 text-sm ${total < 0 ? 'bg-amber-50 text-amber-800' : 'bg-slate-50 text-slate-600'}`}>
              {total < 0
                ? <>Barang pengganti lebih murah. Serahkan <b>{rp(-total)}</b> tunai dari laci kasir ke pembeli — tercatat sebagai uang keluar di shift ini.</>
                : 'Nilai barang sama — tidak ada pembayaran.'}
            </div>
          ) : !split ? (
            <div>
              <p className="label">Metode pembayaran</p>
              <div className="grid grid-cols-5 gap-2">
                {METHODS.map(m => (
                  <button key={m.key} onClick={() => setMethod(m.key)}
                    className={`h-[72px] rounded-xl border-2 flex flex-col items-center justify-center gap-1 text-[13px] font-semibold transition-colors ${method === m.key ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 text-slate-600 hover:border-slate-400'}`}>
                    <m.icon size={20} />{m.label}
                  </button>
                ))}
              </div>
              <button className="text-xs font-semibold text-brand mt-2" onClick={() => setSplit([{ method, amount: total }, { method: method === 'CASH' ? 'QRIS' : 'CASH', amount: 0 }])}>+ Bayar pakai 2 metode</button>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="label">Bayar campur</p>
              {split.map((r, i) => (
                <div key={i} className="flex gap-2">
                  <select className="input w-44" value={r.method} onChange={e => setRow(i, { method: e.target.value })}>
                    {METHODS.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
                  </select>
                  <input className="input flex-1 text-right font-semibold" value={Number(r.amount || 0).toLocaleString('id-ID')} onChange={e => setRow(i, { amount: num(e.target.value) })} />
                  <button className="w-10 text-slate-400" onClick={() => split.length > 2 ? setSplit(s => s.filter((_, j) => j !== i)) : setSplit(null)}><X size={16} /></button>
                </div>
              ))}
              {paid !== total && <p className={`text-sm font-semibold ${paid > total ? 'text-danger' : 'text-amber-600'}`}>{paid > total ? `Lebih ${rp(paid - total)}` : `Kurang ${rp(total - paid)}`}</p>}
            </div>
          )}

          <div>
            <p className="label">Barang pembeli</p>
            <div className="grid grid-cols-2 gap-2">
              {[['NOW', 'Dibawa sekarang', ShoppingBag, 'Barang langsung diserahkan'], ['LATER', 'Ambil nanti', PackageCheck, 'Disiapkan gudang, diambil nanti']].map(([k, l, icon, d]) => { const Icon = icon; return (
                <button key={k} onClick={() => setFulfillment(k)}
                  className={`p-3 rounded-xl border-2 text-left flex gap-3 items-center transition-colors ${fulfillment === k ? 'border-slate-900 bg-slate-50' : 'border-slate-200 hover:border-slate-400'}`}>
                  <Icon size={20} className={fulfillment === k ? 'text-slate-900' : 'text-slate-400'} />
                  <span><span className="block text-sm font-bold text-slate-800">{l}</span><span className="block text-xs text-slate-500">{d}</span></span>
                </button>
              ) })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div><p className="label">Atas nama {fulfillment === 'LATER' ? '' : '(opsional)'}</p>
              <input className="input" value={customer.name} onChange={e => setCustomer(c => ({ ...c, name: e.target.value }))} placeholder="dicetak di struk" /></div>
            <div><p className="label">No. HP {limitErr?.startsWith('Isi') ? '' : '(opsional)'}</p>
              <input className="input" inputMode="tel" value={customer.phone} onChange={e => setCustomer(c => ({ ...c, phone: e.target.value }))} placeholder="untuk konfirmasi, tidak dicetak" /></div>
          </div>
          {fulfillment === 'LATER' && !customer.name.trim() && <p className="text-xs text-amber-600 -mt-3">Isi nama supaya gudang mudah mencocokkan saat pembeli kembali.</p>}
          {limitErr && <p className="text-sm font-semibold text-danger -mt-2">{limitErr}</p>}
          {cashPart > 0 && (
            <div className="rounded-2xl bg-slate-50 p-4 space-y-3">
              <div className="flex items-end gap-4">
                <div className="flex-1">
                  <p className="label">Uang diterima</p>
                  <input className="input text-2xl font-bold text-right h-14" autoFocus value={received === '' ? '' : num(received).toLocaleString('id-ID')} onChange={e => setReceived(e.target.value)} placeholder={cashPart.toLocaleString('id-ID')} />
                </div>
                <div className="text-right pb-1">
                  <p className="text-xs text-slate-500">Kembalian</p>
                  <p className={`text-3xl font-black ${change < 0 ? 'text-danger' : 'text-emerald-600'}`}>{change < 0 ? 'Kurang' : rp(change)}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button className="btn-secondary text-xs" onClick={() => setReceived(String(cashPart))}>Uang pas</button>
                {quickCash(cashPart).map(v => <button key={v} className="btn-secondary text-xs" onClick={() => setReceived(String(v))}>{rp(v)}</button>)}
              </div>
            </div>
          )}


        </div>
        <div className="px-7 py-4 border-t border-slate-100 bg-white">
          <button className="w-full h-14 rounded-xl bg-brand text-white text-lg font-bold hover:brightness-110 disabled:opacity-40" disabled={!valid || busy} onClick={submit} autoFocus={noPay}>
            {busy ? 'Menyimpan…' : noPay ? (total < 0 ? `Selesaikan tukar · kembalikan ${rp(-total)}` : 'Selesaikan tukar') : `Selesaikan pembayaran · ${rp(total)}`}
          </button>
          {!valid && !limitErr && <p className="text-xs text-center text-amber-600 mt-1.5">{paid !== total ? 'Jumlah pembayaran belum sama dengan total' : 'Uang diterima kurang dari total tunai'}</p>}
        </div>
        </div>
      </div>
    </div>
  )
}

function DoneScreen({ order, onPrint, onNew }) {
  const later = order.fulfillment === 'LATER'
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-6">
      <div className="bg-white rounded-3xl w-full max-w-lg p-8 text-center shadow-2xl">
        <CheckCircle2 size={56} className="mx-auto text-emerald-500" />
        <p className="mt-3 text-2xl font-black text-slate-900">{order.exchangeOfNumber ? 'Tukar berhasil' : 'Pembayaran berhasil'}</p>
        {order.total < 0 && (
          <div className="mt-5 rounded-2xl bg-amber-50 py-4">
            <p className="text-xs font-semibold text-amber-700 tracking-wide">KEMBALIKAN TUNAI KE PEMBELI</p>
            <p className="text-4xl font-black text-amber-700">{rp(-order.total)}</p>
          </div>
        )}
        <p className="text-sm text-slate-500">{order.orderNumber}{order.customerName ? ` · ${order.customerName}` : ''}</p>
        {order.change > 0 && (
          <div className="mt-5 rounded-2xl bg-emerald-50 py-4">
            <p className="text-xs font-semibold text-emerald-700 tracking-wide">KEMBALIAN</p>
            <p className="text-4xl font-black text-emerald-700">{rp(order.change)}</p>
          </div>
        )}
        {later && (
          <div className="mt-4 rounded-2xl bg-slate-900 text-white py-4">
            <p className="text-xs font-semibold tracking-[.25em] opacity-70">AMBIL NANTI · NOMOR AMBIL</p>
            <p className="text-4xl font-black tracking-wider">{order.pickupCode}</p>
            <p className="text-xs opacity-70 mt-1">Slip gudang ikut tercetak — serahkan ke staff gudang</p>
          </div>
        )}
        <div className="grid grid-cols-2 gap-2 mt-6">
          <button className="btn-secondary justify-center" onClick={() => onPrint({ customer: true, staff: false })}><Printer size={14} />Struk pelanggan</button>
          <button className="btn-secondary justify-center" onClick={() => onPrint({ customer: false, staff: true })}><Printer size={14} />Slip staff</button>
        </div>
        <button autoFocus className="w-full h-14 mt-3 rounded-xl bg-brand text-white text-lg font-bold hover:brightness-110" onClick={onNew}>Transaksi baru <span className="text-sm font-medium opacity-70">(Enter)</span></button>
      </div>
    </div>
  )
}

// Cari struk asal (scan barcode di struk / ketik nomor), lalu pilih barang yang dikembalikan.
// Struk dari laptop ini bisa dicari offline; struk laptop lain butuh internet.
function ExchangeModal({ eventId, orders, online, skuById, onClose, onStart }) {
  const [number, setNumber] = useState('')
  const [found, setFound] = useState(null)   // { order, returned }
  const [pick, setPick] = useState({})       // skuId -> qty dikembalikan
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)

  const find = async (e) => {
    e?.preventDefault()
    const q = number.trim().toUpperCase()
    if (!q) return
    setBusy(true); setErr(null); setFound(null); setPick({})
    const local = [...orders.queue, ...orders.sent].find(o => String(o.orderNumber).toUpperCase() === q)
    let order = local || null, serverReturned = null
    if (online || !local) {
      try {
        const { data } = await posHttp.get('/pos/orders/lookup', { params: { number: q } })
        order = order || { ...data.order, items: data.order.items.map(i => ({ ...i, productId: i.ProductId })) }
        serverReturned = data.returned
      } catch (ex) {
        if (!local) setErr(ex.response?.status === 404 ? `Struk ${q} tidak ditemukan` : 'Struk dari laptop lain butuh koneksi internet')
      }
    }
    setBusy(false)
    if (!order) return
    if (String(order.eventId) !== String(eventId)) { setErr('Struk ini dari event lain'); return }
    if (order.status === 'VOID') { setErr('Transaksi ini sudah dibatalkan'); return }
    // yang sudah dikembalikan: hitungan server + tukar di laptop ini yang belum terkirim
    const pendingLocal = returnedLocally(orders.queue, order.clientOrderId)
    const returned = serverReturned
      ? Object.fromEntries([...new Set([...Object.keys(serverReturned), ...Object.keys(pendingLocal)])].map(k => [k, (serverReturned[k] || 0) + (pendingLocal[k] || 0)]))
      : returnedLocally([...orders.queue, ...orders.sent], order.clientOrderId)
    setFound({ order, returned })
  }

  const credits = found ? returnCredits(found.order) : {}
  const rows = found ? found.order.items.filter(i => i.qty > 0).map(i => ({
    ...i, left: i.qty - (found.returned[i.ProductSKUId] || 0), credit: credits[i.ProductSKUId]?.credit ?? 0,
  })) : []
  const chosen = rows.filter(r => pick[r.ProductSKUId] > 0)
  const start = () => onStart(found.order, chosen.map(r => {
    const sku = skuById.get(r.ProductSKUId)
    return {
      skuId: r.ProductSKUId, productId: r.productId ?? sku?.productId, code: sku?.code, name: r.name, variant: r.variant,
      qty: pick[r.ProductSKUId], credit: r.credit,
    }
  }))

  return (
    <Modal open onClose={onClose} title="Tukar barang" size="lg">
      <form onSubmit={find} className="flex gap-2">
        <input className="input flex-1 font-mono" autoFocus value={number} onChange={e => setNumber(e.target.value)} placeholder="Scan barcode di struk atau ketik nomor struk" />
        <button className="btn-primary" disabled={busy}>{busy ? 'Mencari…' : 'Cari'}</button>
      </form>
      {err && <p className="text-sm text-danger mt-3">{err}</p>}
      {found && (
        <div className="mt-4 space-y-3">
          <p className="text-sm text-slate-500"><b className="text-slate-800">{found.order.orderNumber}</b> · {new Date(found.order.soldAt).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}{found.order.customerName ? ` · ${found.order.customerName}` : ''}</p>
          <p className="label">Barang yang dikembalikan pembeli</p>
          <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl">
            {rows.map(r => (
              <div key={r.ProductSKUId} className={`flex items-center gap-3 px-4 py-3 ${r.left <= 0 ? 'opacity-50' : ''}`}>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">{shortName(r.name)} {r.variant && <span className="inline-block px-1.5 rounded border border-slate-300 font-bold text-slate-700 text-xs ml-1">{r.variant}</span>}</p>
                  <p className="text-xs text-slate-500">dibeli {r.qty} · dinilai {rp(r.credit)}/pcs{r.left < r.qty ? ` · sudah dikembalikan ${r.qty - r.left}` : ''}</p>
                </div>
                {r.left > 0 ? (
                  <div className="flex items-center rounded-lg border border-slate-200">
                    <button type="button" className="w-8 h-8 flex items-center justify-center text-slate-500" onClick={() => setPick(p => ({ ...p, [r.ProductSKUId]: Math.max((p[r.ProductSKUId] || 0) - 1, 0) }))}><Minus size={14} /></button>
                    <span className="w-8 text-center font-bold text-sm">{pick[r.ProductSKUId] || 0}</span>
                    <button type="button" className="w-8 h-8 flex items-center justify-center text-slate-500" onClick={() => setPick(p => ({ ...p, [r.ProductSKUId]: Math.min((p[r.ProductSKUId] || 0) + 1, r.left) }))}><Plus size={14} /></button>
                  </div>
                ) : <span className="text-xs text-slate-400">sudah dikembalikan semua</span>}
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-400">Nilai kembali = harga yang dulu dibayar (sudah termasuk diskon). Barang kembali masuk stok gudang event.</p>
          <button className="btn-primary w-full justify-center h-11" disabled={!chosen.length} onClick={start}>
            Lanjut · pilih barang pengganti ({chosen.reduce((s, r) => s + pick[r.ProductSKUId], 0)} pcs kembali)
          </button>
        </div>
      )}
    </Modal>
  )
}

function RemoveQueued({ order, onRemoved }) {
  const [confirm, setConfirm] = useState(false)
  if (!confirm) return <button className="text-xs text-slate-400 hover:text-danger" onClick={() => setConfirm(true)}>Hapus</button>
  return (
    <div className="text-right text-xs space-y-1">
      <p className="text-danger">Transaksi {order.orderNumber} hilang permanen?</p>
      <button className="btn-danger text-xs" onClick={onRemoved}>Ya, hapus</button>
    </div>
  )
}

function OpenShift({ eventId, device, userName, onOpened }) {
  const [cash, setCash] = useState('')
  const [busy, setBusy] = useState(false)
  const open = async (openingCash) => {
    setBusy(true)
    try {
      const { data } = await posHttp.post('/pos/shifts', { eventId: Number(eventId), deviceName: `Laptop ${device}`, openingCash })
      onOpened({ id: data.id, openingCash: data.openingCash, openedAt: data.openedAt })
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal membuka kasir. Membuka kasir butuh koneksi internet.')
    } finally { setBusy(false) }
  }
  return (
    <div className="max-w-md mx-auto mt-20 bg-white rounded-3xl p-8 shadow-sm space-y-5">
      <div>
        <p className="text-2xl font-black text-slate-900">Halo, {userName?.split(' ')[0] || 'kasir'} 👋</p>
        <p className="text-sm text-slate-500 mt-1">Buka kasir untuk mulai jualan. Setelah terbuka, kasir tetap jalan walau internet putus.</p>
      </div>
      <form onSubmit={e => { e.preventDefault(); open(num(cash)) }} className="space-y-3">
        <div>
          <p className="label">Modal awal kas <span className="font-normal text-slate-400">(opsional)</span></p>
          <input className="input text-xl h-12" value={cash ? num(cash).toLocaleString('id-ID') : ''} onChange={e => setCash(e.target.value)} placeholder="Rp 0" autoFocus />
        </div>
        <button className="w-full h-12 rounded-xl bg-brand text-white font-bold hover:brightness-110 disabled:opacity-50" disabled={busy}>{busy ? 'Membuka…' : 'Buka kasir'}</button>
      </form>
      <button className="w-full text-sm font-semibold text-slate-500 hover:text-slate-800" disabled={busy} onClick={() => open(0)}>Mulai tanpa modal (cashless)</button>
    </div>
  )
}

function SettingsModal({ settings, event, userName, onClose, onSave }) {
  const [s, setS] = useState(settings)
  const sample = {
    orderNumber: 'TEST-0001', soldAt: new Date().toISOString(), subtotal: 300000, itemDiscount: 0, orderDiscount: 0, total: 300000,
    items: [{ name: 'Contoh produk', variant: 'M', qty: 1, unitPrice: 300000, discount: 0 }], payments: [{ method: 'CASH', amount: 300000 }],
    cashReceived: 300000, change: 0, customerName: 'Pembeli', fulfillment: 'LATER', pickupCode: 'TS-001',
  }
  return (
    <Modal open onClose={onClose} title="Pengaturan struk" size="sm">
      <div className="space-y-4">
        <div><label className="label">Gaya struk</label>
          <div className="flex gap-2">{RECEIPT_STYLES.map(([k, l]) => (
            <button key={k} type="button" onClick={() => setS({ ...s, style: k })} className={`flex-1 justify-center ${s.style === k ? 'btn-primary' : 'btn-secondary'}`}>{l}</button>
          ))}</div></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Lebar kertas (mm)</label><input className="input" type="number" value={s.widthMm} onChange={e => setS({ ...s, widthMm: Number(e.target.value) })} /></div>
          <div><label className="label">Ukuran huruf (px)</label><input className="input" type="number" value={s.fontPx} onChange={e => setS({ ...s, fontPx: Number(e.target.value) })} /></div>
        </div>
        <p className="text-xs text-slate-400 -mt-2">Standar kasir 80 mm. Setiap bayar tercetak 2 lembar: struk pelanggan + slip staff.</p>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={s.autoPrint} onChange={e => setS({ ...s, autoPrint: e.target.checked })} />Cetak otomatis setelah bayar</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!s.showCashier} onChange={e => setS({ ...s, showCashier: e.target.checked })} />Tampilkan nama kasir di struk pelanggan</label>
        <button className="btn-secondary w-full justify-center" onClick={() => printReceipt(orderPrintHtml(sample, { event, settings: s, cashierName: userName }))}><Printer size={14} />Cetak tes (2 lembar)</button>
        <QrisSetting />
        <button className="btn-primary w-full justify-center" onClick={() => onSave(s)}>Simpan</button>
      </div>
    </Modal>
  )
}

// Gambar QRIS statis toko, tampil besar di layar pelanggan saat metode QRIS dipilih. Disimpan di laptop ini.
function QrisSetting() {
  const [img, setImg] = useState(null)
  useEffect(() => { getItem('kv', 'displaySettings').then(d => setImg(d?.qrisImage || null)) }, [])
  const save = async (qrisImage) => {
    const cur = (await getItem('kv', 'displaySettings')) || {}
    await setItem('kv', 'displaySettings', { ...cur, qrisImage })
    setImg(qrisImage)
  }
  const pick = (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    const r = new FileReader()
    r.onload = () => save(r.result).then(() => toast.success('QRIS tersimpan untuk layar pelanggan'))
    r.readAsDataURL(f)
  }
  return (
    <div className="border-t border-slate-100 pt-4">
      <label className="label">QRIS di layar pelanggan</label>
      <div className="flex items-center gap-3">
        {img ? <img src={img} alt="QRIS" className="w-16 h-16 object-contain rounded border border-slate-200" /> : <div className="w-16 h-16 rounded border border-dashed border-slate-300 flex items-center justify-center text-slate-300"><QrCode size={22} /></div>}
        <div className="flex-1 text-xs text-slate-500">Unggah gambar QRIS statis toko. Muncul besar di layar pelanggan saat bayar QRIS.</div>
      </div>
      <div className="flex gap-2 mt-2">
        <label className="btn-secondary text-xs cursor-pointer">{img ? 'Ganti gambar' : 'Unggah gambar'}<input type="file" accept="image/*" className="hidden" onChange={pick} /></label>
        {img && <button type="button" className="btn-secondary text-xs text-danger" onClick={() => save(null)}>Hapus</button>}
      </div>
    </div>
  )
}

function CloseShift({ shift, sync, held, onClose, onClosed }) {
  const [summary, setSummary] = useState(null)
  const [counted, setCounted] = useState('')
  const [err, setErr] = useState(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (sync.pending) return
    posHttp.get(`/pos/shifts/${shift.id}`).then(r => setSummary(r.data.summary)).catch(() => setErr('Butuh koneksi internet untuk tutup shift.'))
  }, [shift.id, sync.pending])
  const close = async () => {
    setBusy(true)
    try { await posHttp.patch(`/pos/shifts/${shift.id}/close`, { countedCash: num(counted) }); toast.success('Shift ditutup'); onClosed() }
    catch (e) { toast.error(e.response?.data?.message || 'Gagal menutup shift') }
    finally { setBusy(false) }
  }
  return (
    <Modal open onClose={onClose} title="Tutup shift">
      {sync.pending ? (
        <p className="text-sm text-amber-700">Masih ada {sync.pending} transaksi belum terkirim. Sambungkan internet dan tunggu sampai semua terkirim sebelum tutup shift.</p>
      ) : err ? <p className="text-sm text-danger">{err}</p> : !summary ? <p className="text-sm text-slate-400">Memuat ringkasan…</p> : (
        <div className="space-y-3 text-sm">
          {held > 0 && <p className="text-amber-700 bg-amber-50 rounded-lg px-3 py-2">Masih ada {held} keranjang ditahan. Keranjang itu tetap tersimpan di laptop ini, tapi belum jadi transaksi.</p>}
          <Line label="Jumlah transaksi" value={summary.orderCount} />
          <Line label="Total penjualan" value={rp(summary.total)} />
          {METHODS.map(m => summary.byMethod[m.key] ? <Line key={m.key} label={m.label} value={rp(summary.byMethod[m.key])} /> : null)}
          <Line label="Modal awal kas" value={rp(shift.openingCash)} />
          <div className="flex justify-between font-bold"><span>Kas tunai seharusnya</span><span>{rp(summary.expectedCash)}</span></div>
          <div><label className="label">Hitungan kas fisik</label><input className="input text-lg text-right" value={counted ? num(counted).toLocaleString('id-ID') : ''} onChange={e => setCounted(e.target.value)} autoFocus placeholder="0" /></div>
          {counted !== '' && <p className={`font-semibold ${num(counted) === summary.expectedCash ? 'text-emerald-600' : 'text-danger'}`}>Selisih: {rp(num(counted) - summary.expectedCash)}</p>}
          <button className="btn-primary w-full justify-center" disabled={counted === '' || busy} onClick={close}>{busy ? 'Menutup…' : 'Tutup shift'}</button>
        </div>
      )}
    </Modal>
  )
}
