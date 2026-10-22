import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ArrowLeft, Minus, Plus, Printer, RefreshCw, Settings, Trash2, Wifi, WifiOff, X, LogOut, History } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import NoPermission from '../components/NoPermission'
import Modal from '../components/Modal'
import { allItems, delItem, deviceId, getItem, nextSeq, requestPersistence, setItem } from '../pos/store'
import { enqueueOrder, onSyncChange, posHttp, startAutoSync, syncQueue, syncState } from '../pos/sync'
import { DEFAULT_RECEIPT, RECEIPT_STYLES, printReceipt, receiptHtml } from '../pos/receipt'

const rp = (n) => 'Rp ' + Number(n || 0).toLocaleString('id-ID')
const METHODS = [['CASH', 'Cash'], ['QRIS', 'QRIS'], ['TRANSFER', 'Transfer'], ['EDC', 'EDC / Kartu'], ['OTHER', 'Lainnya']]
const QUICK_CASH = [50000, 100000, 150000, 200000, 300000, 500000, 1000000]

// "10%" -> persen dari base, "25000" / "25.000" -> rupiah. Dibatasi 0..base.
function parseDiscount(text, base) {
  const s = String(text || '').trim()
  if (!s) return 0
  const v = s.endsWith('%') ? Math.round(base * Number(s.slice(0, -1).replace(',', '.')) / 100) : Number(s.replace(/[^\d]/g, ''))
  return Number.isFinite(v) ? Math.min(Math.max(v, 0), base) : 0
}
const num = (s) => Number(String(s || '').replace(/[^\d]/g, '')) || 0

export default function PosCashier() {
  const { eventId } = useParams()
  const navigate = useNavigate()
  const { user, hasPermission } = useAuth()
  const allowed = hasPermission('pos.manage') || hasPermission('pos.sell')

  const [catalog, setCatalog] = useState(null)      // { event, generatedAt, items }
  const [catalogError, setCatalogError] = useState(null)
  const [shift, setShift] = useState(undefined)     // undefined = memuat, null = belum buka
  const [device, setDevice] = useState('')
  const [settings, setSettings] = useState({ ...DEFAULT_RECEIPT, autoPrint: true })
  const [cart, setCart] = useState([])              // { skuId, code, name, variant, listPrice, unitPrice, qty, discountText }
  const [orderDiscountText, setOrderDiscountText] = useState('')
  const [discountNote, setDiscountNote] = useState('')
  const [scan, setScan] = useState('')
  const [modal, setModal] = useState(null)          // 'pay' | 'history' | 'settings' | 'close' | 'queue'
  const [sync, setSync] = useState({ pending: 0, failed: 0, online: navigator.onLine })
  const [orders, setOrders] = useState({ queue: [], sent: [] })
  const scanRef = useRef(null)

  const refreshOrders = useCallback(async () => {
    const [queue, sent] = await Promise.all([allItems('queue'), allItems('sent')])
    const mine = (o) => String(o.eventId) === String(eventId)
    setOrders({ queue: queue.filter(mine), sent: sent.filter(mine) })
  }, [eventId])

  // ── Muat katalog (online -> simpan; offline -> pakai simpanan) ────────────
  const loadCatalog = useCallback(async (silent) => {
    try {
      const { data } = await posHttp.get(`/pos/events/${eventId}/catalog`)
      await setItem('kv', `catalog:${eventId}`, data)
      setCatalog(data); setCatalogError(null)
      if (!silent) toast.success(`Katalog diperbarui (${data.items.length} SKU)`)
    } catch (err) {
      const cached = await getItem('kv', `catalog:${eventId}`)
      if (cached) { setCatalog(cached); if (!silent) toast('Offline: memakai katalog tersimpan', { icon: '📦' }) }
      else setCatalogError(err.response?.data?.message || 'Katalog belum tersimpan di laptop ini. Sambungkan internet sekali untuk mengunduh katalog.')
    }
  }, [eventId])

  useEffect(() => {
    if (!allowed) return
    deviceId().then(setDevice)
    getItem('kv', 'receiptSettings').then(s => s && setSettings(v => ({ ...v, ...s })))
    getItem('kv', `shift:${eventId}`).then(s => setShift(s || null))
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
  useEffect(() => { if (!modal) focusScan() }, [modal, focusScan])

  // ── Stok tampil = stok katalog - penjualan yang belum ada di server saat katalog dibuat ──
  const byCode = useMemo(() => new Map((catalog?.items ?? []).map(i => [String(i.code).toLowerCase(), i])), [catalog])
  const soldLocal = useMemo(() => {
    const m = {}
    const gen = catalog?.generatedAt || ''
    for (const o of [...orders.queue, ...orders.sent.filter(o => (o.sentAt || '') > gen)]) {
      for (const i of o.items) m[i.ProductSKUId] = (m[i.ProductSKUId] || 0) + i.qty
    }
    return m
  }, [orders, catalog])
  const stockOf = (skuId) => {
    const it = catalog?.items.find(i => i.skuId === skuId)
    return (it?.stock ?? 0) - (soldLocal[skuId] || 0)
  }

  // ── Keranjang ───────────────────────────────────────────────────────────
  const addItem = (it) => {
    setCart(c => {
      const ex = c.find(l => l.skuId === it.skuId)
      if (ex) return c.map(l => l.skuId === it.skuId ? { ...l, qty: l.qty + 1 } : l)
      return [...c, { skuId: it.skuId, code: it.code, name: it.name, variant: it.variant, listPrice: it.price, unitPrice: it.price, qty: 1, discountText: '' }]
    })
    const left = stockOf(it.skuId) - (cart.find(l => l.skuId === it.skuId)?.qty || 0) - 1
    if (left < 0) toast(`Stok sistem ${it.code} habis. Tetap dijual & ditandai untuk dicek.`, { icon: '⚠️' })
  }
  const searchResults = useMemo(() => {
    const q = scan.trim().toLowerCase()
    if (q.length < 2 || !catalog) return []
    return catalog.items.filter(i => i.name.toLowerCase().includes(q) || String(i.code).toLowerCase().includes(q)).slice(0, 8)
  }, [scan, catalog])
  const onScanEnter = () => {
    const code = scan.trim().toLowerCase()
    if (!code) { if (cart.length) setModal('pay'); return }
    const hit = byCode.get(code) || (searchResults.length === 1 ? searchResults[0] : null)
    if (hit) { addItem(hit); setScan('') }
    else if (!searchResults.length) { toast.error(`Barcode "${scan.trim()}" tidak ada di katalog`); setScan('') }
  }
  const updateLine = (skuId, patch) => setCart(c => c.map(l => l.skuId === skuId ? { ...l, ...patch } : l))
  const removeLine = (skuId) => setCart(c => c.filter(l => l.skuId !== skuId))

  const totals = useMemo(() => {
    const lines = cart.map(l => {
      const gross = l.qty * l.unitPrice
      const discount = parseDiscount(l.discountText, gross)
      return { ...l, gross, discount, lineTotal: gross - discount }
    })
    const subtotal = lines.reduce((s, l) => s + l.gross, 0)
    const itemDiscount = lines.reduce((s, l) => s + l.discount, 0)
    const orderDiscount = parseDiscount(orderDiscountText, subtotal - itemDiscount)
    return { lines, subtotal, itemDiscount, orderDiscount, total: subtotal - itemDiscount - orderDiscount }
  }, [cart, orderDiscountText])

  // ── Bayar ───────────────────────────────────────────────────────────────
  const finishOrder = async ({ payments, cashReceived, customerName, customerPhone }) => {
    const seq = await nextSeq(eventId)
    const order = {
      clientOrderId: `${device}-${eventId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      orderNumber: `E${eventId}-${device}-${String(seq).padStart(4, '0')}`,
      eventId: Number(eventId), shiftId: shift?.id ?? null,
      soldAt: new Date().toISOString(),
      items: totals.lines.map(l => ({ ProductSKUId: l.skuId, qty: l.qty, unitPrice: l.unitPrice, discount: l.discount, name: l.name, variant: l.variant })),
      subtotal: totals.subtotal, itemDiscount: totals.itemDiscount, orderDiscount: totals.orderDiscount, total: totals.total,
      discountNote: discountNote || null,
      customerName: customerName || null, customerPhone: customerPhone || null,
      payments, cashReceived,
      change: cashReceived != null ? cashReceived - payments.filter(p => p.method === 'CASH').reduce((s, p) => s + p.amount, 0) : 0,
    }
    await enqueueOrder(order)
    if (settings.autoPrint) printReceipt(receiptHtml(order, { event: catalog?.event, settings, cashierName: user?.name }))
    setCart([]); setOrderDiscountText(''); setDiscountNote(''); setModal(null)
    refreshOrders()
    toast.success(`${order.orderNumber} tersimpan${order.change ? ` — kembalian ${rp(order.change)}` : ''}`)
  }

  // Shortcut: F2 = bayar, Esc = tutup modal. Ketikan/scan saat tidak ada kolom aktif
  // (mis. habis klik tombol) diarahkan ke kolom scan, tanpa merebut fokus dari kolom lain.
  useEffect(() => {
    const h = (e) => {
      if (e.key === 'F2' && cart.length && !modal) { e.preventDefault(); setModal('pay') }
      if (e.key === 'Escape' && modal) setModal(null)
      const tag = document.activeElement?.tagName
      if (!modal && e.key.length === 1 && !e.metaKey && !e.ctrlKey && !['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) scanRef.current?.focus()
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [cart.length, modal])

  if (!allowed) return <NoPermission page="Kasir" />
  if (catalogError) return (
    <Screen onBack={() => navigate('/pos/events')}>
      <div className="card p-6 max-w-lg mx-auto mt-16 text-center space-y-3">
        <WifiOff className="mx-auto text-slate-400" />
        <p className="text-slate-700">{catalogError}</p>
        <button className="btn-primary mx-auto" onClick={() => loadCatalog()}><RefreshCw size={14} />Coba lagi</button>
      </div>
    </Screen>
  )
  if (!catalog || shift === undefined) return <Screen onBack={() => navigate('/pos/events')}><p className="p-8 text-slate-400">Memuat kasir…</p></Screen>
  if (!shift) return (
    <Screen onBack={() => navigate('/pos/events')} title={catalog.event.name}>
      <OpenShift eventId={eventId} device={device} onOpened={async (s) => { await setItem('kv', `shift:${eventId}`, s); setShift(s) }} />
    </Screen>
  )

  const recent = [...orders.queue.map(o => ({ ...o, pending: true })), ...orders.sent].sort((a, b) => b.soldAt.localeCompare(a.soldAt))

  return (
    <Screen onBack={() => navigate('/pos/events')} title={catalog.event.name}
      right={<>
        <SyncBadge sync={sync} onClick={() => sync.failed ? setModal('queue') : syncQueue()} />
        <button className="btn-secondary text-xs" onClick={() => loadCatalog()} title="Perbarui katalog & stok"><RefreshCw size={13} />Katalog</button>
        <button className="btn-secondary text-xs" onClick={() => setModal('history')}><History size={13} />Riwayat</button>
        <button className="btn-secondary text-xs" onClick={() => setModal('settings')}><Settings size={13} /></button>
        <button className="btn-secondary text-xs" onClick={() => setModal('close')}><LogOut size={13} />Tutup shift</button>
      </>}>
      <div className="grid grid-cols-[1fr_360px] gap-4 p-4 h-[calc(100vh-56px)]">
        {/* kiri: scan + keranjang */}
        <div className="flex flex-col min-h-0 gap-3">
          <div className="relative">
            <input ref={scanRef} value={scan} onChange={e => setScan(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); onScanEnter() } }}
              className="input text-lg py-3" placeholder="Scan barcode atau ketik nama produk…  (Enter kosong / F2 = bayar)" autoFocus />
            {searchResults.length > 0 && !byCode.get(scan.trim().toLowerCase()) && (
              <div className="absolute z-10 left-0 right-0 mt-1 card divide-y divide-slate-100 shadow-lg">
                {searchResults.map(it => (
                  <button key={it.skuId} onMouseDown={e => e.preventDefault()} onClick={() => { addItem(it); setScan(''); focusScan() }}
                    className="w-full text-left px-3 py-2 hover:bg-slate-50 flex justify-between text-sm">
                    <span><b>{it.name}</b> {it.variant && <span className="text-slate-500">({it.variant})</span>} <span className="text-xs text-slate-400 font-mono">{it.code}</span></span>
                    <span className="text-slate-500">{rp(it.price)} · stok {stockOf(it.skuId)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="card flex-1 min-h-0 overflow-auto">
            {!cart.length ? <p className="p-8 text-center text-slate-400">Keranjang kosong. Scan barang untuk mulai.</p> : (
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500 uppercase sticky top-0">
                  <tr><th className="text-left px-3 py-2">Produk</th><th className="px-2 py-2">Qty</th><th className="text-right px-2 py-2">Harga</th>
                    <th className="text-right px-2 py-2">Diskon (Rp / %)</th><th className="text-right px-3 py-2">Jumlah</th><th /></tr>
                </thead>
                <tbody>
                  {totals.lines.map(l => (
                    <tr key={l.skuId} className="border-t border-slate-100">
                      <td className="px-3 py-2"><p className="font-semibold text-slate-800">{l.name}</p>
                        <p className="text-xs text-slate-400">{l.variant} · <span className="font-mono">{l.code}</span> · stok {stockOf(l.skuId) - l.qty}</p></td>
                      <td className="px-2 py-2">
                        <div className="flex items-center justify-center gap-1">
                          <button className="p-1 rounded border" onClick={() => l.qty > 1 ? updateLine(l.skuId, { qty: l.qty - 1 }) : removeLine(l.skuId)}><Minus size={12} /></button>
                          <span className="w-8 text-center font-mono font-bold">{l.qty}</span>
                          <button className="p-1 rounded border" onClick={() => updateLine(l.skuId, { qty: l.qty + 1 })}><Plus size={12} /></button>
                        </div>
                      </td>
                      <td className="px-2 py-2 text-right">
                        <input className="input text-right w-28 py-1" value={l.unitPrice.toLocaleString('id-ID')}
                          onChange={e => updateLine(l.skuId, { unitPrice: num(e.target.value) })} />
                        {l.unitPrice !== l.listPrice && <p className="text-[10px] text-amber-600">normal {rp(l.listPrice)}</p>}
                      </td>
                      <td className="px-2 py-2 text-right">
                        <input className="input text-right w-28 py-1" value={l.discountText} placeholder="0"
                          onChange={e => updateLine(l.skuId, { discountText: e.target.value })} />
                        {l.discount > 0 && l.discountText.endsWith('%') && <p className="text-[10px] text-slate-400">-{rp(l.discount)}</p>}
                      </td>
                      <td className="px-3 py-2 text-right font-mono font-semibold">{rp(l.lineTotal)}</td>
                      <td className="pr-2"><button className="p-1 text-slate-400 hover:text-danger" onClick={() => removeLine(l.skuId)}><Trash2 size={14} /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* kanan: total */}
        <div className="card p-4 flex flex-col gap-3">
          <Row label="Subtotal" value={rp(totals.subtotal)} />
          {totals.itemDiscount > 0 && <Row label="Diskon item" value={`-${rp(totals.itemDiscount)}`} />}
          <div>
            <label className="label">Diskon transaksi (Rp / %)</label>
            <input className="input" value={orderDiscountText} onChange={e => setOrderDiscountText(e.target.value)} placeholder="mis. 10% atau 50000" />
            {totals.orderDiscount > 0 && <p className="text-xs text-slate-500 mt-1">-{rp(totals.orderDiscount)}</p>}
          </div>
          {(totals.itemDiscount + totals.orderDiscount) > 0 && (
            <div><label className="label">Alasan diskon (opsional)</label>
              <input className="input" value={discountNote} onChange={e => setDiscountNote(e.target.value)} placeholder="mis. promo bundling" /></div>
          )}
          <div className="border-t pt-3 mt-auto">
            <p className="text-xs text-slate-500">TOTAL</p>
            <p className="text-4xl font-bold font-mono text-slate-800">{rp(totals.total)}</p>
            <p className="text-xs text-slate-400 mt-1">{totals.lines.reduce((s, l) => s + l.qty, 0)} pcs</p>
          </div>
          <button className="btn-primary justify-center py-4 text-lg" disabled={!cart.length} onClick={() => setModal('pay')}>Bayar (F2)</button>
          <button className="btn-secondary justify-center" disabled={!cart.length} onClick={() => { setCart([]); setOrderDiscountText(''); setDiscountNote('') }}>Kosongkan</button>
          <p className="text-[11px] text-slate-400 text-center">Laptop {device} · shift #{shift.id} · kasir {user?.name}</p>
        </div>
      </div>

      {modal === 'pay' && <PayModal total={totals.total} onClose={() => setModal(null)} onPay={finishOrder} />}
      {modal === 'history' && (
        <Modal open onClose={() => setModal(null)} title="Riwayat transaksi laptop ini" size="lg">
          <div className="max-h-[60vh] overflow-auto divide-y divide-slate-100 text-sm">
            {!recent.length && <p className="text-slate-400 p-4">Belum ada transaksi.</p>}
            {recent.slice(0, 100).map(o => (
              <div key={o.clientOrderId} className="flex items-center justify-between py-2 gap-3">
                <div>
                  <p className="font-semibold">{o.orderNumber} <span className="text-xs font-normal text-slate-400">{new Date(o.soldAt).toLocaleTimeString('id-ID')}{o.customerName ? ` · ${o.customerName}` : ''}</span></p>
                  <p className="text-xs text-slate-500">{o.items.map(i => `${i.qty}x ${i.name}${i.variant ? ` ${i.variant}` : ''}`).join(', ')}</p>
                  {o.error && <p className="text-xs text-danger">Ditolak: {o.error}</p>}
                  {o.server?.needsReview && <p className="text-xs text-amber-600">Perlu dicek: {o.server.reviewNote}</p>}
                </div>
                <div className="text-right shrink-0">
                  <p className="font-mono">{rp(o.total)}</p>
                  <p className={`text-[11px] ${o.pending ? 'text-amber-600' : 'text-success'}`}>{o.pending ? 'belum terkirim' : 'terkirim'}</p>
                  <button className="text-xs text-brand inline-flex items-center gap-1" onClick={() => printReceipt(receiptHtml(o, { event: catalog.event, settings, cashierName: user?.name }))}><Printer size={11} />Cetak ulang</button>
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
        <SettingsModal settings={settings} onClose={() => setModal(null)}
          onSave={async (s) => { await setItem('kv', 'receiptSettings', s); setSettings(s); setModal(null) }} />
      )}
      {modal === 'close' && (
        <CloseShift shift={shift} sync={sync} onClose={() => setModal(null)}
          onClosed={async () => { await delItem('kv', `shift:${eventId}`); setShift(null); setModal(null) }} />
      )}
    </Screen>
  )
}

function Screen({ children, onBack, title, right }) {
  return (
    <div className="min-h-screen bg-slate-100">
      <div className="h-14 bg-white border-b border-slate-200 flex items-center gap-3 px-4">
        <button className="btn-secondary text-xs" onClick={onBack}><ArrowLeft size={13} />Event</button>
        <p className="font-bold text-slate-800 truncate">Kasir{title ? ` — ${title}` : ''}</p>
        <div className="ml-auto flex items-center gap-2">{right}</div>
      </div>
      {children}
    </div>
  )
}

const Row = ({ label, value }) => <div className="flex justify-between text-sm"><span className="text-slate-500">{label}</span><span className="font-mono">{value}</span></div>

function SyncBadge({ sync, onClick }) {
  const off = !sync.online
  const cls = sync.failed ? 'bg-red-50 text-danger border-red-200' : off || sync.pending ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
  const text = sync.failed ? `${sync.failed} transaksi ditolak` : off ? `Offline · ${sync.pending} menunggu` : sync.pending ? `${sync.pending} menunggu terkirim` : 'Online · semua terkirim'
  return (
    <button onClick={onClick} className={`text-xs font-semibold px-2.5 py-1.5 rounded-lg border inline-flex items-center gap-1.5 ${cls}`} title="Klik untuk kirim sekarang">
      {off ? <WifiOff size={13} /> : <Wifi size={13} />}{text}
    </button>
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

function OpenShift({ eventId, device, onOpened }) {
  const [cash, setCash] = useState('')
  const [busy, setBusy] = useState(false)
  const open = async (e) => {
    e.preventDefault(); setBusy(true)
    try {
      const { data } = await posHttp.post('/pos/shifts', { eventId: Number(eventId), deviceName: `Laptop ${device}`, openingCash: num(cash) })
      onOpened({ id: data.id, openingCash: data.openingCash, openedAt: data.openedAt })
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal membuka shift. Buka shift butuh koneksi internet.')
    } finally { setBusy(false) }
  }
  return (
    <form onSubmit={open} className="card p-6 max-w-md mx-auto mt-16 space-y-4">
      <p className="font-bold text-slate-800 text-lg">Buka shift</p>
      <p className="text-sm text-slate-500">Isi modal awal kas (uang kembalian di laci). Buka shift perlu internet; setelah itu kasir tetap jalan walau offline.</p>
      <div><label className="label">Modal awal kas</label><input className="input text-lg" value={cash ? num(cash).toLocaleString('id-ID') : ''} onChange={e => setCash(e.target.value)} placeholder="0" autoFocus /></div>
      <button className="btn-primary w-full justify-center py-3" disabled={busy}>{busy ? 'Membuka…' : 'Buka shift'}</button>
    </form>
  )
}

function PayModal({ total, onClose, onPay }) {
  const [rows, setRows] = useState([{ method: 'CASH', amount: total }])
  const [received, setReceived] = useState('')
  const [customer, setCustomer] = useState({ name: '', phone: '' })
  const [busy, setBusy] = useState(false)
  const paid = rows.reduce((s, r) => s + (Number(r.amount) || 0), 0)
  const cashPart = rows.filter(r => r.method === 'CASH').reduce((s, r) => s + (Number(r.amount) || 0), 0)
  const recv = received === '' ? cashPart : num(received)
  const change = recv - cashPart
  // total 0 (diskon 100%) boleh tanpa pembayaran
  const valid = paid === total && (!cashPart || recv >= cashPart)
  const setRow = (i, patch) => setRows(rs => rs.map((r, j) => j === i ? { ...r, ...patch } : r))
  const submit = async () => {
    if (!valid || busy) return
    setBusy(true)
    await onPay({
      payments: rows.filter(r => Number(r.amount) > 0).map(r => ({ method: r.method, amount: Number(r.amount) })),
      cashReceived: cashPart ? recv : null,
      customerName: customer.name.trim(), customerPhone: customer.phone.trim(),
    })
  }
  return (
    <Modal open onClose={onClose} title="Pembayaran">
      <div className="space-y-4" onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); submit() } }}>
        <p className="text-center"><span className="text-xs text-slate-500 block">Total</span><span className="text-3xl font-bold font-mono">{rp(total)}</span></p>
        {rows.map((r, i) => (
          <div key={i} className="flex gap-2 items-center">
            <select className="input w-40" value={r.method} onChange={e => setRow(i, { method: e.target.value })}>
              {METHODS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
            <input className="input flex-1 text-right" value={Number(r.amount || 0).toLocaleString('id-ID')} onChange={e => setRow(i, { amount: num(e.target.value) })} />
            {rows.length > 1 && <button className="p-1 text-slate-400" onClick={() => setRows(rs => rs.filter((_, j) => j !== i))}><X size={14} /></button>}
          </div>
        ))}
        {paid !== total && (
          <div className="flex items-center justify-between text-sm">
            <span className={paid > total ? 'text-danger' : 'text-amber-600'}>{paid > total ? `Lebih ${rp(paid - total)}` : `Kurang ${rp(total - paid)}`}</span>
            {paid < total && <button className="text-brand text-xs" onClick={() => setRows(rs => [...rs, { method: 'QRIS', amount: total - paid }])}>+ metode lain untuk sisa</button>}
          </div>
        )}
        {cashPart > 0 && (
          <div className="space-y-2">
            <label className="label">Uang tunai diterima</label>
            <input className="input text-lg text-right" autoFocus value={received === '' ? '' : num(received).toLocaleString('id-ID')} onChange={e => setReceived(e.target.value)} placeholder={cashPart.toLocaleString('id-ID')} />
            <div className="flex flex-wrap gap-1.5">
              <button className="btn-secondary text-xs" onClick={() => setReceived(String(cashPart))}>Uang pas</button>
              {QUICK_CASH.filter(v => v > cashPart).slice(0, 4).map(v => <button key={v} className="btn-secondary text-xs" onClick={() => setReceived(String(v))}>{rp(v)}</button>)}
            </div>
            <p className={`text-lg font-bold ${change < 0 ? 'text-danger' : 'text-slate-800'}`}>Kembalian: {rp(Math.max(change, 0))}{change < 0 ? ' (uang kurang)' : ''}</p>
          </div>
        )}
        <div className="grid grid-cols-2 gap-2 pt-1 border-t">
          <div><label className="label">Atas nama (opsional)</label>
            <input className="input" value={customer.name} onChange={e => setCustomer(c => ({ ...c, name: e.target.value }))} placeholder="dicetak di struk" /></div>
          <div><label className="label">No. HP (opsional)</label>
            <input className="input" inputMode="tel" value={customer.phone} onChange={e => setCustomer(c => ({ ...c, phone: e.target.value }))} placeholder="tidak dicetak" /></div>
        </div>
        <button className="btn-primary w-full justify-center py-3 text-lg" disabled={!valid || busy} onClick={submit}>{busy ? 'Menyimpan…' : 'Selesai & cetak struk (Enter)'}</button>
      </div>
    </Modal>
  )
}

function SettingsModal({ settings, onClose, onSave }) {
  const [s, setS] = useState(settings)
  return (
    <Modal open onClose={onClose} title="Pengaturan struk" size="sm">
      <div className="space-y-3">
        <div><label className="label">Lebar kertas (mm)</label><input className="input" type="number" value={s.widthMm} onChange={e => setS({ ...s, widthMm: Number(e.target.value) })} />
          <p className="text-xs text-slate-400 mt-1">Standar kasir 80 mm. Pakai 58 mm kalau printernya model portabel kecil.</p></div>
        <div><label className="label">Gaya struk</label>
          <div className="flex gap-2">{RECEIPT_STYLES.map(([k, l]) => (
            <button key={k} type="button" onClick={() => setS({ ...s, style: k })} className={`flex-1 justify-center ${s.style === k ? 'btn-primary' : 'btn-secondary'}`}>{l}</button>
          ))}</div></div>
        <div><label className="label">Ukuran huruf (px)</label><input className="input" type="number" value={s.fontPx} onChange={e => setS({ ...s, fontPx: Number(e.target.value) })} /></div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={s.autoPrint} onChange={e => setS({ ...s, autoPrint: e.target.checked })} />Cetak struk otomatis setelah bayar</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!s.showCashier} onChange={e => setS({ ...s, showCashier: e.target.checked })} />Tampilkan nama kasir di struk</label>
        <button className="btn-secondary w-full justify-center" onClick={() => printReceipt(receiptHtml({
          orderNumber: 'TEST-0001', soldAt: new Date().toISOString(), subtotal: 300000, itemDiscount: 0, orderDiscount: 0, total: 300000,
          items: [{ name: 'Contoh produk', variant: 'M', qty: 1, unitPrice: 300000, discount: 0 }], payments: [{ method: 'CASH', amount: 300000 }], cashReceived: 300000, change: 0,
          customerName: 'Pembeli',
        }, { event: { name: 'Tes printer' }, settings: s }))}><Printer size={14} />Cetak struk tes</button>
        <button className="btn-primary w-full justify-center" onClick={() => onSave(s)}>Simpan</button>
      </div>
    </Modal>
  )
}

function CloseShift({ shift, sync, onClose, onClosed }) {
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
          <Row label="Jumlah transaksi" value={summary.orderCount} />
          <Row label="Total penjualan" value={rp(summary.total)} />
          {METHODS.map(([k, l]) => summary.byMethod[k] ? <Row key={k} label={l} value={rp(summary.byMethod[k])} /> : null)}
          <Row label="Modal awal kas" value={rp(shift.openingCash)} />
          <div className="flex justify-between font-bold"><span>Kas seharusnya</span><span className="font-mono">{rp(summary.expectedCash)}</span></div>
          <div><label className="label">Hitungan kas fisik</label><input className="input text-lg text-right" value={counted ? num(counted).toLocaleString('id-ID') : ''} onChange={e => setCounted(e.target.value)} autoFocus /></div>
          {counted !== '' && <p className={`font-semibold ${num(counted) === summary.expectedCash ? 'text-success' : 'text-danger'}`}>Selisih: {rp(num(counted) - summary.expectedCash)}</p>}
          <button className="btn-primary w-full justify-center" disabled={counted === '' || busy} onClick={close}>{busy ? 'Menutup…' : 'Tutup shift'}</button>
        </div>
      )}
    </Modal>
  )
}
