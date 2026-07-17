import { useState, useEffect, useRef, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { requestApi, requestTypeApi } from '../api'
import { productsApi, productSkusApi } from '../api'
import { useAuth } from '../context/AuthContext'
import {
  ArrowLeft, Check, X, Send, RotateCcw, CheckCircle2,
  Pencil, Save, PackageCheck, Plus, Trash2, ChevronDown,
  Clock, ThumbsUp, ThumbsDown, AlertTriangle, Truck, ExternalLink,
} from 'lucide-react'

const STATUS_LABEL = { DRAFT:'Draft', PENDING:'Menunggu', APPROVED:'Disetujui', REJECTED:'Ditolak', SENT:'Dikirim', DONE:'Selesai' }
const STATUS_COLOR = {
  DRAFT:    'bg-slate-100 text-slate-500 border-slate-200',
  PENDING:  'bg-amber-100 text-amber-700 border-amber-200',
  APPROVED: 'bg-blue-100 text-blue-700 border-blue-200',
  REJECTED: 'bg-red-100 text-red-700 border-red-200',
  SENT:     'bg-purple-100 text-purple-700 border-purple-200',
  DONE:     'bg-emerald-100 text-emerald-700 border-emerald-200',
}
const STEPS_NORMAL   = ['PENDING','APPROVED','SENT','DONE']
const STEPS_RETURN   = ['PENDING','APPROVED','SENT','RETURNED','DONE']
const STEPS_INTERNAL = ['PENDING','APPROVED','DONE']
const STEP_LABEL = { PENDING:'Menunggu', APPROVED:'Disetujui', SENT:'Dikirim', RETURNED:'Dikembalikan', DONE:'Selesai' }

const CAT_BADGE = {
  sales:     'bg-indigo-100 text-indigo-700 border-indigo-200',
  non_sales: 'bg-violet-100 text-violet-700 border-violet-200',
  stock_out: 'bg-emerald-100 text-emerald-700 border-emerald-200',
}
const CAT_LABEL = { sales: 'Sales', non_sales: 'Non-Sales', stock_out: 'Jatah Internal' }

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('id-ID', { day:'2-digit', month:'short', year:'numeric' }) : '—'
const fmtDt   = (d) => d ? new Date(d).toLocaleString ('id-ID', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' }) : '—'

// ── Field display ─────────────────────────────────────────────────────────────
function Field({ label, value }) {
  return (
    <div>
      <div className="text-xs text-slate-400 mb-0.5">{label}</div>
      <div className="text-sm text-slate-700 font-medium">{value || '—'}</div>
    </div>
  )
}

// ── Inline SKU picker (for edit mode) ─────────────────────────────────────────
function SkuPickerInline({ onAdd }) {
  const [search,     setSearch]     = useState('')
  const [open,       setOpen]       = useState(false)
  const [selProduct, setSelProduct] = useState(null)
  const [selSku,     setSelSku]     = useState(null)
  const [qty,        setQty]        = useState(1)
  const [note,       setNote]       = useState('')
  const inputRef = useRef(null)

  const { data: products } = useQuery({
    queryKey: ['products', { limit: 500 }],
    queryFn: () => productsApi.list({ limit: 500 }),
  })
  const { data: skusData } = useQuery({
    queryKey: ['product-skus', selProduct?.id],
    queryFn: () => productSkusApi.list(selProduct.id),
    enabled: !!selProduct,
  })

  const filtered = useMemo(() => {
    const list = products?.data ?? []
    if (!search.trim()) return list
    const q = search.toLowerCase()
    return list.filter(p => p.name.toLowerCase().includes(q))
  }, [products, search])

  const skuVariantLabel = (sku) => (sku.ProductVariantOptions ?? []).map(v => v.value).join(' / ')

  const handleAdd = () => {
    if (!selProduct) return toast.error('Pilih produk terlebih dahulu')
    if (!qty || Number(qty) < 1) return toast.error('Qty minimal 1')
    onAdd({
      ProductSKUId: selSku?.id ?? null,
      productName:  selProduct.name,
      variantLabel: selSku ? skuVariantLabel(selSku) : '',
      qty:          Number(qty),
      note,
    })
    setSearch(''); setSelProduct(null); setSelSku(null); setQty(1); setNote('')
  }

  return (
    <div className="border border-dashed border-slate-200 rounded-lg p-3 space-y-2 bg-slate-50 mt-2">
      <div className="grid grid-cols-2 gap-2">
        <div className="relative">
          <label className="label mb-1 text-xs">Produk</label>
          <div className="input flex items-center gap-2 cursor-text bg-white"
               onClick={() => { setOpen(true); inputRef.current?.focus() }}>
            <input ref={inputRef} value={search}
              onChange={e => { setSearch(e.target.value); setOpen(true); setSelProduct(null); setSelSku(null) }}
              onFocus={() => setOpen(true)}
              onBlur={() => setTimeout(() => setOpen(false), 150)}
              placeholder="Cari nama produk…"
              className="flex-1 bg-transparent outline-none text-sm placeholder-slate-400" />
            <ChevronDown size={12} className="text-slate-400 flex-shrink-0" />
          </div>
          {open && filtered.length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-20 max-h-40 overflow-y-auto">
              {filtered.map(p => (
                <button key={p.id} type="button"
                  onMouseDown={() => { setSelProduct(p); setSearch(p.name); setSelSku(null); setOpen(false) }}
                  className="w-full text-left px-3 py-2 hover:bg-slate-50 text-sm border-b border-slate-50 last:border-0">
                  {p.name}
                </button>
              ))}
            </div>
          )}
        </div>
        <div>
          <label className="label mb-1 text-xs">Varian / SKU</label>
          <select value={selSku?.id ?? ''} onChange={e => setSelSku((skusData ?? []).find(s => s.id == e.target.value) ?? null)}
            className="input text-sm bg-white" disabled={!selProduct}>
            <option value="">— pilih varian —</option>
            {(skusData ?? []).map(s => (
              <option key={s.id} value={s.id}>{skuVariantLabel(s) || s.sku_code}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 items-end">
        <div>
          <label className="label mb-1 text-xs">Qty</label>
          <input type="number" min={1} value={qty} onChange={e => setQty(e.target.value)}
            className="input text-sm bg-white w-full" />
        </div>
        <div className="col-span-2">
          <label className="label mb-1 text-xs">Catatan (opsional)</label>
          <input value={note} onChange={e => setNote(e.target.value)} placeholder="warna, ukuran, dll"
            className="input text-sm bg-white w-full" />
        </div>
      </div>
      <button type="button" onClick={handleAdd}
        className="btn-secondary text-xs flex items-center gap-1.5 w-full justify-center">
        <Plus size={12} /> Tambah Item
      </button>
    </div>
  )
}

// ── Modals ────────────────────────────────────────────────────────────────────
function RejectModal({ onConfirm, onClose }) {
  const [reason, setReason] = useState('')
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl p-5 w-full max-w-sm">
        <h3 className="font-semibold text-slate-800 mb-3">Alasan Penolakan</h3>
        <textarea value={reason} onChange={e => setReason(e.target.value)}
          placeholder="Tulis alasan penolakan…" rows={3} className="input w-full resize-none mb-3" autoFocus />
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="btn-secondary text-sm">Batal</button>
          <button onClick={() => { if (!reason.trim()) return toast.error('Isi alasan penolakan'); onConfirm(reason) }}
            className="btn-primary text-sm bg-red-600 border-red-600 hover:bg-red-700">Tolak</button>
        </div>
      </div>
    </div>
  )
}

function SentModal({ onConfirm, onClose, items }) {
  const today = new Date().toISOString().split('T')[0]
  const [sentAt, setSentAt]                 = useState(today)
  const [trackingNumber, setTrackingNumber] = useState('')
  const [shippingNote, setShippingNote]     = useState('')
  const [itemQtys, setItemQtys]            = useState(() =>
    Object.fromEntries((items ?? []).map(i => [i.id, i.qty]))
  )
  const isPartial = (items ?? []).some(i => Number(itemQtys[i.id] ?? i.qty) < i.qty)

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl p-5 w-full max-w-md">
        <h3 className="font-semibold text-slate-800 mb-3">Tandai Dikirim</h3>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label mb-1">Tanggal Kirim</label>
              <input type="date" value={sentAt} onChange={e => setSentAt(e.target.value)} className="input w-full" />
            </div>
            <div>
              <label className="label mb-1">No. Resi (opsional)</label>
              <input value={trackingNumber} onChange={e => setTrackingNumber(e.target.value)}
                placeholder="JNE123456" className="input w-full" />
            </div>
          </div>
          {(items ?? []).length > 0 && (
            <div>
              <label className="label mb-1.5">Qty dikirim per item</label>
              <div className="space-y-1.5">
                {(items ?? []).map(item => (
                  <div key={item.id} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2">
                    <div className="text-sm text-slate-700 truncate flex-1 min-w-0">
                      {item.sku?.Product?.name ?? item.productName}
                      {item.variantLabel && <span className="text-slate-400 ml-1">· {item.variantLabel}</span>}
                    </div>
                    <div className="flex items-center gap-1.5 ml-3 flex-shrink-0">
                      <input
                        type="number" min={0} max={item.qty}
                        value={itemQtys[item.id] ?? item.qty}
                        onChange={e => setItemQtys(q => ({ ...q, [item.id]: Math.min(item.qty, Math.max(0, Number(e.target.value))) }))}
                        className="input w-14 text-center text-sm py-1"
                      />
                      <span className="text-xs text-slate-400">/ {item.qty}</span>
                    </div>
                  </div>
                ))}
              </div>
              {isPartial && (
                <p className="text-xs text-amber-600 mt-1.5">⚠ Pengiriman sebagian — sisa item akan tercatat sebagai hutang stok</p>
              )}
            </div>
          )}
          <div>
            <label className="label mb-1">Catatan Pengiriman (opsional)</label>
            <textarea value={shippingNote} onChange={e => setShippingNote(e.target.value)}
              placeholder="Contoh: sisa 1 item menyusul minggu depan…"
              rows={2} className="input w-full resize-none text-sm" />
          </div>
        </div>
        <div className="flex gap-2 justify-end mt-4">
          <button onClick={onClose} className="btn-secondary text-sm">Batal</button>
          <button onClick={() => onConfirm({
            sentAt, trackingNumber,
            shippingNote: shippingNote.trim() || null,
            items: (items ?? []).map(i => ({ id: i.id, shippedQty: Number(itemQtys[i.id] ?? i.qty) })),
          })} className="btn-primary text-sm">Simpan</button>
        </div>
      </div>
    </div>
  )
}

function ReturnModal({ onConfirm, onClose }) {
  const today = new Date().toISOString().split('T')[0]
  const [returnedAt, setReturnedAt] = useState(today)
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl p-5 w-full max-w-sm">
        <h3 className="font-semibold text-slate-800 mb-3">Tandai Dikembalikan</h3>
        <div>
          <label className="label mb-1">Tanggal Kembali</label>
          <input type="date" value={returnedAt} onChange={e => setReturnedAt(e.target.value)} className="input w-full" />
        </div>
        <div className="flex gap-2 justify-end mt-4">
          <button onClick={onClose} className="btn-secondary text-sm">Batal</button>
          <button onClick={() => onConfirm({ returnedAt })} className="btn-primary text-sm">Simpan</button>
        </div>
      </div>
    </div>
  )
}

// ── Status stepper ────────────────────────────────────────────────────────────
function StatusStepper({ status, needsReturn, returnedAt, shipmentType }) {
  if (status === 'DRAFT') return (
    <div className="flex items-center gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl">
      <span className="w-6 h-6 rounded-full bg-slate-400 text-white flex items-center justify-center flex-shrink-0">
        <Pencil size={11} />
      </span>
      <span className="text-sm font-medium text-slate-600">Masih Draft — belum masuk antrian approval</span>
    </div>
  )

  if (status === 'REJECTED') return (
    <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl">
      <span className="w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center flex-shrink-0">
        <X size={12} />
      </span>
      <span className="text-sm font-medium text-red-700">Pengajuan Ditolak</span>
    </div>
  )

  const isInternal = shipmentType === 'stock_out'
  const steps = isInternal ? STEPS_INTERNAL : needsReturn ? STEPS_RETURN : STEPS_NORMAL
  let currentIdx
  if (isInternal) {
    currentIdx = status === 'DONE' ? 2 : status === 'APPROVED' ? 1 : 0
  } else if (!needsReturn) {
    currentIdx = STEPS_NORMAL.indexOf(status)
  } else {
    if      (status === 'PENDING')              currentIdx = 0
    else if (status === 'APPROVED')             currentIdx = 1
    else if (status === 'SENT' && !returnedAt)  currentIdx = 2
    else if (status === 'SENT' && returnedAt)   currentIdx = 3
    else if (status === 'DONE')                 currentIdx = 4
    else                                        currentIdx = 0
  }

  return (
    <div className="flex items-center gap-0 overflow-x-auto pb-1">
      {steps.map((step, idx) => {
        const done   = idx < currentIdx
        const active = idx === currentIdx
        return (
          <div key={step} className="flex items-center min-w-0">
            <div className="flex flex-col items-center flex-shrink-0">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                done   ? 'bg-emerald-500 text-white' :
                active ? 'bg-indigo-600 text-white ring-4 ring-indigo-100' :
                         'bg-slate-200 text-slate-400'
              }`}>
                {done ? <Check size={13} /> : idx + 1}
              </div>
              <span className={`text-[10px] mt-1 font-medium whitespace-nowrap ${
                active ? 'text-indigo-600' : done ? 'text-emerald-600' : 'text-slate-400'
              }`}>{STEP_LABEL[step]}</span>
            </div>
            {idx < steps.length - 1 && (
              <div className={`h-0.5 w-10 sm:w-16 mx-1 flex-shrink-0 ${idx < currentIdx ? 'bg-emerald-400' : 'bg-slate-200'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Guided Next Action Card ───────────────────────────────────────────────────
function NextActionCard({
  req, canProcess, resolvedShipmentType,
  onApprove, onReject, onSent, onReturn, onShipRemaining, onDone, onProcessShipment, onDirectShipment, navigate,
  loadingApprove, loadingSent, loadingReturn, loadingShipRemaining, loadingDone, loadingProcessShipment, loadingDirectShipment,
}) {
  if (!canProcess) return null
  const { status, needsReturn, returnedAt, items = [] } = req
  const hasDebt = items.some(i => i.shippedQty !== null && i.shippedQty < i.qty)
  const returnSatisfied = !needsReturn || !!returnedAt
  const shipmentType = resolvedShipmentType

  if (status === 'DONE' || status === 'REJECTED') return null

  const isAutoShipping = shipmentType === 'sales' || shipmentType === 'non_sales' || shipmentType === 'stock_out'
  // Escape hatch: barang harus dikirim sekarang tapi belum di-stock-in, jadi
  // Stock Out pasti gagal cek stok. Hanya untuk tipe yang berujung shipping.
  const canSkipStockOut = (shipmentType === 'sales' || shipmentType === 'non_sales') && !req.manualShipmentId
  const skipStockOutBtn = canSkipStockOut ? (
    <button onClick={onDirectShipment} disabled={loadingDirectShipment}
      className="btn-secondary text-sm flex items-center gap-2 justify-center w-full text-amber-600 border-amber-200 hover:bg-amber-50">
      <Truck size={14} /> {loadingDirectShipment ? 'Membuat…' : 'Langsung Shipping (Skip Stock Out)'}
    </button>
  ) : null

  const configs = {
    PENDING: {
      icon: <Clock size={16} className="text-amber-500" />,
      title: 'Pengajuan Menunggu Tindakan',
      desc: isAutoShipping
        ? 'Tinjau detail pengajuan. Setujui untuk membuat draft Stock Out — stok baru terpotong setelah Stock Out itu diproses.'
        : 'Tinjau detail pengajuan lalu setujui atau tolak.',
      actions: (
        <div className="flex flex-col gap-2">
          <button onClick={onApprove} disabled={loadingApprove}
            className="btn-primary text-sm flex items-center gap-2 justify-center bg-emerald-600 border-emerald-600 hover:bg-emerald-700">
            <ThumbsUp size={14} /> {loadingApprove ? 'Menyetujui…' : 'Setujui'}
          </button>
          <button onClick={onReject}
            className="btn-secondary text-sm flex items-center gap-2 justify-center text-red-500 border-red-200 hover:bg-red-50">
            <ThumbsDown size={14} /> Tolak
          </button>
        </div>
      ),
    },
    APPROVED: {
      icon: <Send size={16} className="text-blue-500" />,
      title: isAutoShipping && req.manualShipmentId
        ? 'Draft Shipping Dibuat'
        : isAutoShipping && req.stockOutDraftId
        ? 'Menunggu Stock Out'
        : isAutoShipping
        ? 'Stock Out Belum Dibuat'
        : 'Siap Dikirim',
      desc: isAutoShipping && req.manualShipmentId
        ? 'Stock Out sudah selesai dan draft Shipping Manual sudah dibuat otomatis. Proses pengiriman di halaman shipping.'
        : isAutoShipping && req.stockOutDraftId
        ? 'Barang belum keluar gudang. Proses Stock Out-nya dulu — Shipping Manual baru dibuat otomatis setelah Stock Out selesai.'
        : isAutoShipping
        ? 'Draft Stock Out sebelumnya sudah dibatalkan/hilang. Buat ulang untuk melanjutkan.'
        : 'Pengajuan sudah disetujui. Tandai barang ketika sudah dikirim ke penerima.',
      actions: isAutoShipping && req.manualShipmentId ? (
        <button onClick={() => navigate(`/shipping-manual/${req.manualShipmentId}`)}
          className="btn-primary text-sm flex items-center gap-2 justify-center w-full">
          <Truck size={14} /> Lihat Draft Shipping
        </button>
      ) : isAutoShipping && req.stockOutDraftId ? (
        <div className="flex flex-col gap-2">
          <button onClick={() => navigate(`/stock-out/new?draftId=${req.stockOutDraftId}`)}
            className="btn-primary text-sm flex items-center gap-2 justify-center w-full bg-amber-600 border-amber-600 hover:bg-amber-700">
            <PackageCheck size={14} /> Proses Stock Out
          </button>
          {skipStockOutBtn}
        </div>
      ) : isAutoShipping ? (
        <div className="flex flex-col gap-2">
          <button onClick={onProcessShipment} disabled={loadingProcessShipment}
            className="btn-secondary text-sm flex items-center gap-2 justify-center w-full">
            <PackageCheck size={14} /> {loadingProcessShipment ? 'Membuat…' : 'Buat Ulang Stock Out'}
          </button>
          {skipStockOutBtn}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <button onClick={onSent} disabled={loadingSent}
            className="btn-primary text-sm flex items-center gap-2 justify-center">
            <Send size={14} /> {loadingSent ? 'Menyimpan…' : 'Tandai Dikirim'}
          </button>
          <button onClick={onReject}
            className="btn-secondary text-sm flex items-center gap-2 justify-center text-red-500 border-red-200 hover:bg-red-50">
            <ThumbsDown size={14} /> Tolak
          </button>
        </div>
      ),
    },
    SENT_DEBT: {
      icon: <AlertTriangle size={16} className="text-amber-500" />,
      title: 'Ada Item Belum Dikirim',
      desc: 'Sebagian item belum dikirim. Selesaikan hutang stok terlebih dahulu.',
      actions: (
        <div className="flex flex-col gap-2">
          <button onClick={onShipRemaining} disabled={loadingShipRemaining}
            className="btn-primary text-sm flex items-center gap-2 justify-center bg-indigo-500 border-indigo-500 hover:bg-indigo-600">
            <PackageCheck size={14} /> {loadingShipRemaining ? 'Memproses…' : 'Kirim Semua Sisa'}
          </button>
        </div>
      ),
    },
    SENT_RETURN: {
      icon: <RotateCcw size={16} className="text-amber-500" />,
      title: 'Menunggu Pengembalian',
      desc: 'Barang sudah dikirim dan perlu dikembalikan. Tandai setelah barang diterima kembali.',
      actions: (
        <button onClick={onReturn} disabled={loadingReturn}
          className="btn-primary text-sm flex items-center gap-2 justify-center bg-amber-500 border-amber-500 hover:bg-amber-600 w-full">
          <RotateCcw size={14} /> {loadingReturn ? 'Menyimpan…' : 'Tandai Dikembalikan'}
        </button>
      ),
    },
    SENT_DONE: {
      icon: <CheckCircle2 size={16} className="text-emerald-500" />,
      title: 'Siap Diselesaikan',
      desc: 'Semua item sudah dikirim dan kewajiban pengembalian terpenuhi.',
      actions: (
        <button onClick={onDone} disabled={loadingDone}
          className="btn-primary text-sm flex items-center gap-2 justify-center bg-emerald-600 border-emerald-600 hover:bg-emerald-700 w-full">
          <CheckCircle2 size={14} /> {loadingDone ? 'Menyimpan…' : 'Selesaikan'}
        </button>
      ),
    },
  }

  let cfg
  if (status === 'PENDING')  cfg = configs.PENDING
  else if (status === 'APPROVED') cfg = configs.APPROVED
  else if (status === 'SENT') {
    if (hasDebt) cfg = configs.SENT_DEBT
    else if (!returnSatisfied) cfg = configs.SENT_RETURN
    else cfg = configs.SENT_DONE
  }

  if (!cfg) return null

  return (
    <div className="card p-4 border-l-4 border-l-indigo-400">
      <div className="flex items-center gap-2 mb-2">
        {cfg.icon}
        <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Langkah Selanjutnya</span>
      </div>
      <p className="text-sm font-semibold text-slate-800 mb-1">{cfg.title}</p>
      <p className="text-xs text-slate-500 mb-3 leading-relaxed">{cfg.desc}</p>
      {cfg.actions}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function PengajuanDetail() {
  const { id }     = useParams()
  const navigate   = useNavigate()
  const qc         = useQueryClient()
  const { user, hasPermission } = useAuth()

  const [showReject,          setShowReject]          = useState(false)
  const [showSent,            setShowSent]            = useState(false)
  const [showReturn,          setShowReturn]          = useState(false)
  const [editing,             setEditing]             = useState(false)
  const [form,                setForm]                = useState(null)
  const [formItems,           setFormItems]           = useState([])

  const { data: types } = useQuery({ queryKey: ['request-types'], queryFn: requestTypeApi.list })

  const { data: req, isLoading, error } = useQuery({
    queryKey: ['request', id],
    queryFn:  () => requestApi.get(id),
  })

  const buildForm = (r) => ({
    requestTypeId:    r.requestTypeId    ?? '',
    recipientName:    r.recipientName    ?? '',
    recipientPhone:   r.recipientPhone   ?? '',
    recipientAddress: r.recipientAddress ?? '',
    neededAt:         r.neededAt ? r.neededAt.split('T')[0] : '',
    divisi:           r.divisi           ?? '',
    note:             r.note             ?? '',
    needsReturn:      r.needsReturn      ?? false,
  })

  const buildFormItems = (r) =>
    (r.items ?? []).map(i => ({
      ProductSKUId: i.ProductSKUId ?? null,
      productName:  i.sku?.Product?.name ?? i.productName,
      variantLabel: i.variantLabel ?? (i.sku?.ProductVariantOptions ?? []).map(v => v.value).join(' / '),
      qty:          i.qty,
      note:         i.note ?? '',
    }))

  useEffect(() => {
    if (req && !form) {
      setForm(buildForm(req))
      setFormItems(buildFormItems(req))
    }
  }, [req])

  const invalidate = () => qc.invalidateQueries({ queryKey: ['request', id] })

  // Fallback sama dengan backend: jika shipmentType null tapi requiresShipping → non_sales
  const resolveShipmentType = (rt) =>
    rt?.shipmentType ?? (rt?.requiresShipping ? 'non_sales' : null)

  const approve = useMutation({
    mutationFn: (data) => requestApi.approve(id, data),
    onSuccess: (updated) => {
      invalidate()
      // Pakai requestType dari response server (lebih reliable dari component state)
      const sType = resolveShipmentType(updated?.requestType ?? req?.requestType)
      if ((sType === 'sales' || sType === 'non_sales') && updated?.manualShipmentId) {
        toast.success('Draft shipping otomatis dibuat!')
        navigate(`/shipping-manual/${updated.manualShipmentId}`)
      }
    },
    onError: e => toast.error(e.response?.data?.message ?? 'Gagal'),
  })
  const handleApprove = () => {
    if (!confirm('Setujui pengajuan ini?')) return
    approve.mutate({})
  }
  const reject           = useMutation({ mutationFn: (r) => requestApi.reject(id, r),           onSuccess: invalidate, onError: e => toast.error(e.response?.data?.message ?? 'Gagal') })
  const processShipment  = useMutation({
    mutationFn: () => requestApi.processShipment(id),
    onSuccess: (data) => { invalidate(); toast.success('Draft Stock Out berhasil dibuat!'); navigate(`/stock-out/new?draftId=${data.stockOutDraftId}`) },
    onError: e => toast.error(e.response?.data?.message ?? 'Gagal membuat Stock Out'),
  })
  const directShipment = useMutation({
    mutationFn: () => requestApi.directShipment(id),
    onSuccess: (data) => {
      invalidate()
      toast.success('Draft shipping dibuat — Stock Out dilewati')
      if (data?.manualShipmentId) navigate(`/shipping-manual/${data.manualShipmentId}`)
    },
    onError: e => toast.error(e.response?.data?.message ?? 'Gagal membuat shipping'),
  })
  const markSent      = useMutation({ mutationFn: (d) => requestApi.markSent(id, d),          onSuccess: invalidate, onError: e => toast.error(e.response?.data?.message ?? 'Gagal') })
  const markReturned  = useMutation({ mutationFn: (d) => requestApi.markReturned(id, d),      onSuccess: invalidate, onError: e => toast.error(e.response?.data?.message ?? 'Gagal') })
  const shipRemaining = useMutation({ mutationFn: () => requestApi.shipRemaining(id),         onSuccess: invalidate, onError: e => toast.error(e.response?.data?.message ?? 'Gagal') })
  const markDone      = useMutation({ mutationFn: () => requestApi.markDone(id),              onSuccess: invalidate, onError: e => toast.error(e.response?.data?.message ?? 'Gagal') })
  const submitDraft   = useMutation({
    mutationFn: () => requestApi.submit(id),
    onSuccess: () => { invalidate(); toast.success('Pengajuan diajukan — menunggu persetujuan') },
    onError: e => toast.error(e.response?.data?.message ?? 'Gagal mengajukan'),
  })
  const destroy       = useMutation({ mutationFn: () => requestApi.destroy(id),              onSuccess: () => navigate('/pengajuan'), onError: e => toast.error(e.response?.data?.message ?? 'Gagal') })

  const saveEdit = useMutation({
    mutationFn: () => {
      // Draft boleh disimpan tanpa produk — divalidasi lagi saat diajukan
      if (formItems.length === 0 && req?.status !== 'DRAFT') throw new Error('Minimal 1 produk harus diisi')
      return requestApi.update(id, { ...form, items: formItems })
    },
    onSuccess: () => { invalidate(); setEditing(false); toast.success('Pengajuan diperbarui') },
    onError: e => toast.error(e.message ?? e.response?.data?.message ?? 'Gagal menyimpan'),
  })

  const canProcess = hasPermission('request.process') || hasPermission('request.manage') ||
                     user?.role === 'SUPER_ADMIN' || user?.role === 'COMPANY_ADMIN'
  const isOwn      = req?.requestorId === user?.id
  const canEdit    = ['DRAFT', 'PENDING'].includes(req?.status) && (isOwn || canProcess)
  const canDelete  = canEdit
  const isDraft    = req?.status === 'DRAFT'

  if (isLoading) return <div className="px-6 py-6 text-sm text-slate-400">Memuat…</div>
  if (error)     return (
    <div className="flex flex-col items-center justify-center h-64 gap-3">
      <p className="text-slate-500 text-sm">Gagal memuat data. Server mungkin sedang tidak aktif.</p>
      <button onClick={() => window.location.reload()} className="btn-secondary text-sm">Refresh</button>
    </div>
  )
  if (!req) return null

  const skuVariantLabel = (item) =>
    item.sku ? (item.sku.ProductVariantOptions ?? []).map(v => v.value).join(' / ') : item.variantLabel

  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const reqShipmentType  = resolveShipmentType(req.requestType)
  const isInternalReq    = reqShipmentType === 'stock_out'
  const editReqType      = form ? (types ?? []).find(t => String(t.id) === String(form.requestTypeId)) ?? req.requestType : req.requestType
  const editShipmentType = resolveShipmentType(editReqType)
  const isInternalEdit   = editShipmentType === 'stock_out'

  return (
    <div className="px-4 md:px-6 py-6 max-w-6xl mx-auto">
      {/* Modals */}
      {showReject           && <RejectModal           onClose={() => setShowReject(false)}           onConfirm={(r) => { reject.mutate(r); setShowReject(false) }} />}
      {showSent             && <SentModal             onClose={() => setShowSent(false)}             onConfirm={(d) => { markSent.mutate(d); setShowSent(false) }} items={req?.items ?? []} />}
      {showReturn           && <ReturnModal           onClose={() => setShowReturn(false)}           onConfirm={(d) => { markReturned.mutate(d); setShowReturn(false) }} />}

      {/* Back + header */}
      <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-4">
        <ArrowLeft size={14} /> Semua Pengajuan
      </button>

      <div className="flex items-start justify-between mb-4 flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-lg font-bold text-slate-800">Pengajuan #{req.id}</h1>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${STATUS_COLOR[req.status]}`}>
              {STATUS_LABEL[req.status]}
            </span>
            {req.manualShipment && (
              <button
                onClick={() => navigate(`/shipping-manual/${req.manualShipment.id}`)}
                className="flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border bg-violet-50 text-violet-700 border-violet-200 hover:bg-violet-100 transition-colors"
              >
                <Truck size={10} /> Shipping {req.manualShipment.invoiceNumber} <ExternalLink size={9} />
              </button>
            )}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            {resolveShipmentType(req.requestType) && (
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${CAT_BADGE[resolveShipmentType(req.requestType)] ?? 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                {CAT_LABEL[resolveShipmentType(req.requestType)] ?? resolveShipmentType(req.requestType)}
              </span>
            )}
            <span className="text-xs text-slate-400">{req.requestType?.name} · Dibuat {fmtDt(req.createdAt)}</span>
          </div>
        </div>

        {/* Edit / delete / cancel edit buttons */}
        <div className="flex gap-2 flex-wrap">
          {canEdit && !editing && (
            <button onClick={() => setEditing(true)} className="btn-secondary text-xs flex items-center gap-1">
              <Pencil size={11} /> Edit
            </button>
          )}
          {editing && (
            <>
              <button onClick={() => { setEditing(false); setForm(buildForm(req)); setFormItems(buildFormItems(req)) }}
                className="btn-secondary text-xs flex items-center gap-1">
                <X size={11} /> Batal Edit
              </button>
              <button onClick={() => saveEdit.mutate()} disabled={saveEdit.isPending}
                className="btn-primary text-xs flex items-center gap-1">
                <Save size={11} /> {saveEdit.isPending ? 'Menyimpan…' : 'Simpan'}
              </button>
            </>
          )}
          {canDelete && !editing && (
            <button onClick={() => { if (confirm('Hapus pengajuan ini?')) destroy.mutate() }}
              className="btn-secondary text-xs text-red-500 border-red-200 hover:bg-red-50 flex items-center gap-1">
              <X size={11} /> Hapus
            </button>
          )}
        </div>
      </div>

      {/* Status stepper (full width) */}
      <div className="card p-4 mb-5">
        <StatusStepper
          status={req.status}
          needsReturn={req.needsReturn}
          returnedAt={req.returnedAt}
          shipmentType={resolveShipmentType(req.requestType)}
        />
      </div>

      {/* Rejection reason */}
      {req.status === 'REJECTED' && req.rejectionReason && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-5 text-sm text-red-700">
          <span className="font-medium">Alasan ditolak: </span>{req.rejectionReason}
        </div>
      )}

      {/* 2-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left: info (2/3) */}
        <div className="lg:col-span-2 space-y-4">
          {/* Detail pengajuan */}
          <div className="card p-4">
            <h2 className="text-sm font-semibold text-slate-600 mb-3 border-b border-slate-100 pb-2">Detail Pengajuan</h2>
            {editing && form ? (
              <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                <div>
                  <label className="label mb-1">Jenis Pengajuan</label>
                  <select value={form.requestTypeId} onChange={e => {
                    const newId  = e.target.value
                    const newRt  = (types ?? []).find(t => String(t.id) === newId)
                    const newSType = resolveShipmentType(newRt ?? null)
                    setF('requestTypeId', newId)
                    if (newSType === 'stock_out') setF('needsReturn', false)
                  }} className="input w-full text-sm">
                    <option value="">— Pilih —</option>
                    {(types ?? []).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label mb-1">Divisi</label>
                  <input value={form.divisi} onChange={e => setF('divisi', e.target.value)} className="input w-full text-sm" />
                </div>
                {!isInternalEdit && (
                  <>
                    <div>
                      <label className="label mb-1">Nama Penerima</label>
                      <input value={form.recipientName} onChange={e => setF('recipientName', e.target.value)} className="input w-full text-sm" />
                    </div>
                    <div>
                      <label className="label mb-1">No. HP Penerima</label>
                      <input value={form.recipientPhone} onChange={e => setF('recipientPhone', e.target.value)} placeholder="08xxxxxxxxxx" className="input w-full text-sm" />
                    </div>
                  </>
                )}
                <div>
                  <label className="label mb-1">Tanggal Butuh</label>
                  <input type="date" value={form.neededAt} onChange={e => setF('neededAt', e.target.value)} className="input w-full text-sm" />
                </div>
                {!isInternalEdit && (
                  <div className="col-span-2">
                    <label className="label mb-1">Alamat Pengiriman</label>
                    <textarea value={form.recipientAddress} onChange={e => setF('recipientAddress', e.target.value)}
                      rows={2} className="input w-full text-sm resize-none" />
                  </div>
                )}
                <div className="col-span-2">
                  <label className="label mb-1">Catatan</label>
                  <input value={form.note} onChange={e => setF('note', e.target.value)} className="input w-full text-sm" />
                </div>
                {!isInternalEdit && (
                  <div className="flex items-center gap-2 col-span-2">
                    <input type="checkbox" id="needsReturn" checked={form.needsReturn}
                      onChange={e => setF('needsReturn', e.target.checked)} className="w-4 h-4" />
                    <label htmlFor="needsReturn" className="text-sm text-slate-700">Perlu dikembalikan</label>
                  </div>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                <Field label="Pengaju" value={req.requestor?.name} />
                <Field label="Divisi"  value={req.divisi} />
                {!isInternalReq && (
                  <>
                    <Field label="Penerima"        value={req.recipientName} />
                    <Field label="No. HP Penerima" value={req.recipientPhone} />
                  </>
                )}
                <Field label="Tanggal Butuh" value={fmtDate(req.neededAt)} />
                {!isInternalReq && (
                  <div className="col-span-2">
                    <Field label="Alamat Pengiriman" value={req.recipientAddress} />
                  </div>
                )}
                {req.note && (
                  <div className="col-span-2">
                    <Field label="Catatan" value={req.note} />
                  </div>
                )}
                {!isInternalReq && (
                  <Field label="Perlu Dikembalikan" value={req.needsReturn ? 'Ya' : 'Tidak'} />
                )}
                {isInternalReq && (
                  <div className="col-span-2">
                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 text-xs text-emerald-700">
                      Setelah disetujui, stok dikeluarkan lewat Stock Out — tidak lewat proses shipping.
                    </div>
                  </div>
                )}
                {req.processor && <Field label="Diproses oleh" value={req.processor?.name} />}
              </div>
            )}
          </div>

          {/* Info pengiriman — tidak relevan untuk jatah internal */}
          {!isInternalReq && (req.status === 'SENT' || req.status === 'DONE' || req.sentAt || req.trackingNumber || req.returnedAt) && (
            <div className={`card p-4 border-l-4 ${req.status === 'DONE' ? 'border-l-emerald-400' : 'border-l-purple-400'}`}>
              <h2 className="text-sm font-semibold text-slate-600 mb-3 border-b border-slate-100 pb-2 flex items-center gap-2">
                <Send size={13} className="text-purple-500" /> Info Pengiriman
              </h2>
              <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                <Field label="Tanggal Kirim"    value={fmtDate(req.sentAt)} />
                <Field label="No. Resi / Kode"  value={req.trackingNumber} />
                {req.needsReturn && (
                  <Field label="Tanggal Kembali"
                    value={req.returnedAt ? fmtDate(req.returnedAt) : '⏳ Belum kembali'} />
                )}
                {req.processor && (
                  <Field label="Diproses oleh" value={req.processor?.name} />
                )}
              </div>
              {req.shippingNote && (
                <div className="mt-3 p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                  <span className="font-semibold">Catatan pengiriman: </span>{req.shippingNote}
                </div>
              )}
            </div>
          )}

          {/* Daftar produk */}
          <div className="card p-4">
            {editing ? (
              <>
                <h2 className="text-sm font-semibold text-slate-600 mb-3 border-b border-slate-100 pb-2">Daftar Produk</h2>
                {formItems.length === 0 && (
                  <p className="text-xs text-slate-400 text-center py-3">Belum ada produk</p>
                )}
                <div className="space-y-1.5 mb-2">
                  {formItems.map((item, i) => (
                    <div key={i} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2">
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium text-slate-700">{item.productName}</span>
                        {item.variantLabel && <span className="text-xs text-slate-400 ml-1.5">— {item.variantLabel}</span>}
                        <div className="flex items-center gap-2 mt-1">
                          <label className="text-xs text-slate-400">Qty</label>
                          <input
                            type="number" min={1} value={item.qty}
                            onChange={e => setFormItems(prev => prev.map((it, idx) => idx === i ? { ...it, qty: Number(e.target.value) } : it))}
                            className="input w-16 text-sm h-6 py-0 text-center"
                          />
                          {item.note && <span className="text-xs text-slate-400 italic">{item.note}</span>}
                        </div>
                      </div>
                      <button type="button"
                        onClick={() => setFormItems(prev => prev.filter((_, idx) => idx !== i))}
                        className="text-red-400 hover:text-red-600 p-1 ml-2 flex-shrink-0">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
                <SkuPickerInline onAdd={(item) => setFormItems(prev => [...prev, item])} />
              </>
            ) : (
              (() => {
                const hasAnyDebt = (req.items ?? []).some(i => i.shippedQty !== null && i.shippedQty < i.qty)
                return (
                  <>
                    <h2 className="text-sm font-semibold text-slate-600 mb-3 border-b border-slate-100 pb-2 flex items-center gap-2">
                      Produk ({req.items?.length ?? 0} item)
                      {hasAnyDebt && (
                        <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 border border-amber-200">
                          ⚠ Ada hutang stok
                        </span>
                      )}
                    </h2>
                    <div className="space-y-2">
                      {(req.items ?? []).map((item) => {
                        const vLabel = skuVariantLabel(item)
                        const isPartialItem = item.shippedQty !== null && item.shippedQty < item.qty
                        const remaining = isPartialItem ? item.qty - item.shippedQty : 0
                        return (
                          <div key={item.id} className={`flex items-center justify-between rounded-lg px-3 py-2.5 ${isPartialItem ? 'bg-amber-50 border border-amber-200' : 'bg-slate-50'}`}>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-slate-700 truncate">
                                {item.sku?.Product?.name ?? item.productName}
                              </div>
                              {vLabel && <div className="text-xs text-slate-400 mt-0.5">{vLabel}</div>}
                              {isPartialItem && (
                                <div className="text-xs text-amber-600 mt-0.5 font-medium">Sisa belum dikirim: {remaining}</div>
                              )}
                              {item.note && !item.note.startsWith('size:') && (
                                <div className="text-xs text-slate-400 italic">{item.note}</div>
                              )}
                            </div>
                            <div className="ml-3 flex-shrink-0 text-right">
                              {item.shippedQty !== null ? (
                                <div>
                                  <span className={`text-sm font-semibold ${isPartialItem ? 'text-amber-600' : 'text-emerald-600'}`}>
                                    {item.shippedQty}/{item.qty}
                                  </span>
                                  <div className="text-[10px] text-slate-400">dikirim</div>
                                </div>
                              ) : (
                                <div className="text-sm font-semibold text-indigo-600">×{item.qty}</div>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </>
                )
              })()
            )}
          </div>
        </div>

        {/* Right: action panel (1/3, sticky) */}
        <div className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          {isDraft && (isOwn || canProcess) && (
            <div className="card p-4 border-l-4 border-l-slate-300">
              <div className="flex items-center gap-2 mb-2">
                <Pencil size={16} className="text-slate-400" />
                <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Draft</span>
              </div>
              <p className="text-sm font-semibold text-slate-800 mb-1">Pengajuan Belum Diajukan</p>
              <p className="text-xs text-slate-500 mb-3 leading-relaxed">
                Draft ini hanya terlihat oleh kamu. Lengkapi detail dan produk, lalu ajukan supaya masuk antrian approval.
              </p>
              {(req.items?.length ?? 0) === 0 && (
                <p className="text-xs text-amber-600 mb-2">⚠ Tambahkan minimal 1 produk dulu sebelum bisa diajukan.</p>
              )}
              <button
                onClick={() => { if (confirm('Ajukan pengajuan ini? Setelah diajukan akan masuk antrian approval.')) submitDraft.mutate() }}
                disabled={submitDraft.isPending || (req.items?.length ?? 0) === 0 || editing}
                className="btn-primary text-sm flex items-center gap-2 justify-center w-full disabled:opacity-50">
                <Send size={14} /> {submitDraft.isPending ? 'Mengajukan…' : 'Ajukan Pengajuan'}
              </button>
            </div>
          )}

          <NextActionCard
            req={req}
            canProcess={canProcess}
            navigate={navigate}
            resolvedShipmentType={resolveShipmentType(req?.requestType ?? null)}
            onApprove={handleApprove}
            onReject={() => setShowReject(true)}
            onSent={() => setShowSent(true)}
            onReturn={() => setShowReturn(true)}
            onShipRemaining={() => { if (confirm('Tandai semua sisa item sebagai sudah dikirim?')) shipRemaining.mutate() }}
            onDone={() => { if (confirm('Tandai pengajuan ini selesai?')) markDone.mutate() }}
            onProcessShipment={() => processShipment.mutate()}
            onDirectShipment={() => {
              if (confirm('Buat shipping TANPA Stock Out?\n\nStok tidak akan terpotong di sistem — pakai ini hanya kalau barang belum sempat di-stock-in tapi harus dikirim sekarang.')) directShipment.mutate()
            }}
            loadingApprove={approve.isPending}
            loadingSent={markSent.isPending}
            loadingReturn={markReturned.isPending}
            loadingShipRemaining={shipRemaining.isPending}
            loadingDone={markDone.isPending}
            loadingProcessShipment={processShipment.isPending}
            loadingDirectShipment={directShipment.isPending}
          />

          {/* Info card — always show */}
          <div className="card p-4 space-y-2 text-xs text-slate-500">
            <div className="flex justify-between">
              <span>Dibuat</span>
              <span className="font-medium text-slate-700">{fmtDate(req.createdAt)}</span>
            </div>
            <div className="flex justify-between">
              <span>Pengaju</span>
              <span className="font-medium text-slate-700">{req.requestor?.name ?? '—'}</span>
            </div>
            {req.neededAt && (
              <div className="flex justify-between">
                <span>Butuh sebelum</span>
                <span className="font-medium text-amber-600">{fmtDate(req.neededAt)}</span>
              </div>
            )}
            {req.needsReturn && (
              <div className="flex justify-between">
                <span>Pengembalian</span>
                <span className={`font-medium ${req.returnedAt ? 'text-emerald-600' : 'text-amber-600'}`}>
                  {req.returnedAt ? `↩ ${fmtDate(req.returnedAt)}` : '⏳ Belum kembali'}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
