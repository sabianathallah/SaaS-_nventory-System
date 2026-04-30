import { useState, useMemo, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { stockInApi, warehousesApi, productsApi, productSkusApi } from '../api'
import { useAuth } from '../context/AuthContext'
import QRScanner from '../components/QRScanner'
import toast from 'react-hot-toast'
import { exportExcel } from '../utils/exportExcel'
import {
  ArrowLeft, PackagePlus, ScanLine, Plus, Trash2,
  Save, ChevronDown, Package, CheckCircle2, X, FileSpreadsheet,
} from 'lucide-react'

const fmt     = (n) => Number(n ?? 0).toLocaleString('id-ID')
const fmtDate = (d) => d ? new Date(d).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10)

const skuLabel = (sku) => {
  const opts = sku?.ProductVariantOptions ?? []
  if (!opts.length) return sku?.sku_code ?? ''
  return opts.map(o => o.value).join(' / ')
}

// ── Product → SKU picker (admin only) ────────────────────────────────────────
function ProductSkuPicker({ onSelect }) {
  const [search, setSearch]         = useState('')
  const [open, setOpen]             = useState(false)
  const [selProduct, setSelProduct] = useState(null)
  const [selSku, setSelSku]         = useState(null)
  const [qty, setQty]               = useState(1)
  const [price, setPrice]           = useState('')
  const inputRef = useRef(null)

  const { data: products } = useQuery({
    queryKey: ['products', { limit: 500 }],
    queryFn:  () => productsApi.list({ limit: 500 }),
  })

  const { data: skus } = useQuery({
    queryKey: ['product-skus', selProduct?.id],
    queryFn:  () => productSkusApi.list(selProduct.id),
    enabled:  !!selProduct,
  })

  const filtered = useMemo(() => {
    const list = products?.data ?? []
    if (!search.trim()) return list
    const q = search.toLowerCase()
    return list.filter(p => p.name.toLowerCase().includes(q))
  }, [products, search])

  const selectProduct = (prod) => {
    setSelProduct(prod)
    setSearch(prod.name)
    setSelSku(null)
    setPrice('')
    setOpen(false)
    inputRef.current?.blur()
  }

  const selectSku = (sku) => {
    setSelSku(sku)
    setPrice(String(sku.price ?? ''))
  }

  const handleAdd = () => {
    if (!selSku) return toast.error('Pilih SKU produk terlebih dahulu')
    if (!qty || Number(qty) <= 0) return toast.error('Qty harus lebih dari 0')
    onSelect({ sku: selSku, quantity: Number(qty), price: Number(price) || 0 })
    // Reset
    setSearch(''); setSelProduct(null); setSelSku(null); setQty(1); setPrice('')
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {/* Product search */}
        <div className="relative">
          <label className="label mb-1">Produk</label>
          <div
            className="input flex items-center gap-2 cursor-text"
            onClick={() => { setOpen(true); inputRef.current?.focus() }}
          >
            <input
              ref={inputRef}
              className="flex-1 bg-transparent outline-none text-sm placeholder-slate-400 min-w-0"
              placeholder="Cari nama produk…"
              value={search}
              onChange={e => { setSearch(e.target.value); setOpen(true); setSelProduct(null); setSelSku(null) }}
              onFocus={() => setOpen(true)}
              onBlur={() => setTimeout(() => setOpen(false), 150)}
            />
            <ChevronDown size={13} className="text-slate-400 flex-shrink-0" />
          </div>
          {open && filtered.length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-20 max-h-52 overflow-y-auto">
              {filtered.map(p => (
                <button
                  key={p.id}
                  type="button"
                  onMouseDown={() => selectProduct(p)}
                  className="w-full text-left px-3 py-2 hover:bg-slate-50 border-b border-slate-50 last:border-0 flex items-center gap-2"
                >
                  {p.imageUrl
                    ? <img src={p.imageUrl} className="w-7 h-7 rounded object-cover flex-shrink-0" />
                    : <div className="w-7 h-7 rounded bg-slate-100 flex items-center justify-center flex-shrink-0"><Package size={12} className="text-slate-300" /></div>
                  }
                  <span className="text-sm text-slate-800 truncate">{p.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* SKU dropdown */}
        <div>
          <label className="label mb-1">Varian / SKU</label>
          <select
            className="select"
            value={selSku?.id ?? ''}
            onChange={e => {
              const found = (skus ?? []).find(s => String(s.id) === e.target.value)
              if (found) selectSku(found)
            }}
            disabled={!selProduct || !skus}
          >
            <option value="">{selProduct ? 'Pilih varian…' : '← Pilih produk dulu'}</option>
            {(skus ?? []).map(s => (
              <option key={s.id} value={s.id}>
                {skuLabel(s) || s.sku_code} — Rp {fmt(s.price)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Qty + Price + Add */}
      {selSku && (
        <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2.5">
          {selProduct?.imageUrl
            ? <img src={selProduct.imageUrl} className="w-9 h-9 rounded object-cover flex-shrink-0 border border-slate-200" />
            : <div className="w-9 h-9 rounded bg-slate-100 flex items-center justify-center flex-shrink-0"><Package size={14} className="text-slate-300" /></div>
          }
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-800 truncate">{selProduct?.name}</p>
            <p className="text-xs text-slate-500">{skuLabel(selSku)}</p>
          </div>
          <input
            type="number" min="1" placeholder="Qty"
            className="input w-20 text-center"
            value={qty}
            onChange={e => setQty(e.target.value)}
          />
          <input
            type="number" min="0" placeholder="Harga"
            className="input w-32"
            value={price}
            onChange={e => setPrice(e.target.value)}
          />
          <button type="button" onClick={handleAdd} className="btn-primary flex-shrink-0">
            <Plus size={14} /> Tambah
          </button>
        </div>
      )}
    </div>
  )
}

// ── Item row (view mode) ──────────────────────────────────────────────────────
function ItemRow({ item, canDelete, headerId }) {
  const qc = useQueryClient()
  const sku   = item.ProductSKU
  const prod  = sku?.Product
  const total = Number(item.price) * item.quantity

  const removeMutation = useMutation({
    mutationFn: () => stockInApi.removeItem(headerId, item.id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['stock-in', String(headerId)] }); toast.success('Item dihapus') },
    onError:   e => toast.error(e.response?.data?.message || 'Error'),
  })

  return (
    <tr className="tr border-b border-slate-100 hover:bg-slate-50/50">
      <td className="td py-3 w-14">
        {prod?.imageUrl
          ? <img src={prod.imageUrl} alt={prod.name} className="w-10 h-10 rounded object-cover border border-slate-200" />
          : <div className="w-10 h-10 rounded bg-slate-100 flex items-center justify-center"><Package size={16} className="text-slate-300" /></div>
        }
      </td>
      <td className="td py-3">
        <p className="font-semibold text-slate-800 text-sm leading-tight">{prod?.name ?? '—'}</p>
        <p className="text-xs text-slate-400 mt-0.5">{skuLabel(sku)}</p>
        <p className="text-[10px] font-mono text-slate-300 mt-0.5">{sku?.sku_code}</p>
      </td>
      <td className="td py-3 text-right">
        <span className="font-bold text-slate-800">{item.quantity}</span>
        <span className="text-xs text-slate-400 ml-1">{prod?.unit}</span>
      </td>
      <td className="td py-3 text-right font-mono text-sm text-slate-600">Rp {fmt(item.price)}</td>
      <td className="td py-3 text-right font-mono font-semibold text-slate-800">Rp {fmt(total)}</td>
      {canDelete && (
        <td className="td py-3 w-10">
          <button
            onClick={() => removeMutation.mutate()}
            disabled={removeMutation.isPending}
            className="p-1.5 rounded text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"
          >
            <Trash2 size={13} />
          </button>
        </td>
      )}
    </tr>
  )
}

// ── Items table ───────────────────────────────────────────────────────────────
function ItemsTable({ items, canDelete, headerId, onRemovePending }) {
  const cols = canDelete ? 6 : 5
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="bg-slate-50 border-b border-slate-200">
          <th className="th py-2 w-14">Foto</th>
          <th className="th py-2 text-left">Nama SKU</th>
          <th className="th py-2 text-right w-24">Qty</th>
          <th className="th py-2 text-right w-36">Harga</th>
          <th className="th py-2 text-right w-36">Total</th>
          {canDelete && <th className="th py-2 w-10"></th>}
        </tr>
      </thead>
      <tbody>
        {!items.length && (
          <tr><td colSpan={cols} className="td py-10 text-center text-slate-400">Belum ada item</td></tr>
        )}
        {items.map((item, idx) => {
          if (item.id) return <ItemRow key={item.id} item={item} canDelete={canDelete} headerId={headerId} />
          const prod = item.sku.Product
          return (
            <tr key={idx} className="tr border-b border-slate-100 hover:bg-slate-50/50">
              <td className="td py-3">
                {prod?.imageUrl
                  ? <img src={prod.imageUrl} className="w-10 h-10 rounded object-cover border border-slate-200" />
                  : <div className="w-10 h-10 rounded bg-slate-100 flex items-center justify-center"><Package size={14} className="text-slate-300" /></div>
                }
              </td>
              <td className="td py-3">
                <p className="font-semibold text-slate-800 leading-tight">{prod?.name}</p>
                <p className="text-xs text-slate-400">{skuLabel(item.sku)}</p>
              </td>
              <td className="td py-3 text-right font-bold text-slate-800">{item.quantity}</td>
              <td className="td py-3 text-right font-mono text-slate-600">Rp {fmt(item.price)}</td>
              <td className="td py-3 text-right font-mono font-semibold text-slate-800">Rp {fmt(item.price * item.quantity)}</td>
              <td className="td py-3">
                <button type="button" onClick={() => onRemovePending(idx)}
                  className="p-1.5 rounded text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors">
                  <Trash2 size={13} />
                </button>
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

// ── Scan confirm popup (barcode-only mode) ────────────────────────────────────
// Muncul setelah scan berhasil — user konfirmasi qty sebelum item ditambah
function ScanConfirm({ sku, onConfirm, onCancel }) {
  const [qty,   setQty]   = useState(1)
  const [price, setPrice] = useState(String(sku.price ?? ''))
  const prod = sku.Product

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-5 space-y-4 animate-fade-in">
        {/* Product preview */}
        <div className="flex items-center gap-3">
          {prod?.imageUrl
            ? <img src={prod.imageUrl} className="w-12 h-12 rounded-xl object-cover border border-slate-200 flex-shrink-0" />
            : <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0"><Package size={18} className="text-slate-300" /></div>
          }
          <div className="min-w-0">
            <p className="font-bold text-slate-800 leading-tight truncate">{prod?.name ?? 'Produk'}</p>
            <p className="text-xs text-slate-400 mt-0.5">{skuLabel(sku)}</p>
            <p className="text-[10px] font-mono text-green-600 mt-0.5 flex items-center gap-1">
              <CheckCircle2 size={10} /> Barcode cocok
            </p>
          </div>
        </div>

        {/* Qty + Price */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Jumlah (Qty) <span className="text-red-500">*</span></label>
            <input
              type="number" min="1" className="input text-center font-bold text-lg"
              value={qty} onChange={e => setQty(e.target.value)}
              autoFocus
            />
          </div>
          <div>
            <label className="label">Harga / unit</label>
            <input
              type="number" min="0" className="input"
              value={price} onChange={e => setPrice(e.target.value)}
              placeholder="0"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onCancel}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors">
            <X size={14} /> Batal
          </button>
          <button
            type="button"
            onClick={() => {
              if (!qty || Number(qty) <= 0) return toast.error('Qty harus > 0')
              onConfirm({ sku, quantity: Number(qty), price: Number(price) || 0 })
            }}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-brand text-white text-sm font-semibold hover:bg-red-700 transition-colors"
          >
            <Plus size={14} /> Tambah Item
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function StockInDetail() {
  const { id }          = useParams()
  const navigate        = useNavigate()
  const qc              = useQueryClient()
  const { hasPermission } = useAuth()
  const isNew           = !id || id === 'new'

  // Granular permission flags
  const canManualInput = hasPermission('stock.in.manual_input')
  const canDeleteItem  = hasPermission('stock.in.delete_item')

  const [form, setForm]             = useState({ date: fmtDate(), WarehouseId: '', note: '' })
  const [pendingItems, setPending]  = useState([])
  const [showScanner, setShowScanner] = useState(false)
  const [scanConfirm, setScanConfirm] = useState(null) // { sku } — waiting for qty confirm

  const { data: detail, isLoading } = useQuery({
    queryKey: ['stock-in', id],
    queryFn:  () => stockInApi.get(id),
    enabled:  !isNew && !!id,
  })

  const { data: warehouses } = useQuery({
    queryKey: ['warehouses', { limit: 100 }],
    queryFn:  () => warehousesApi.list({ limit: 100 }),
  })

  const createMutation = useMutation({
    mutationFn: (payload) => stockInApi.create(payload),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['stock-in'] })
      toast.success('Stock IN berhasil dibuat')
      navigate(`/stock-in/${data.id}`)
    },
    onError: e => toast.error(e.response?.data?.message || 'Error'),
  })

  const addItem = ({ sku, quantity, price }) => {
    setPending(prev => {
      const idx = prev.findIndex(p => p.sku.id === sku.id)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = { ...next[idx], quantity: next[idx].quantity + quantity, price: price || next[idx].price }
        return next
      }
      return [...prev, { sku, quantity, price }]
    })
  }

  // QR scan handler
  // - canManualInput: add immediately qty=1 (they can also use manual picker)
  // - barcode-only: show ScanConfirm popup to enter qty before adding
  const handleScan = async (code) => {
    setShowScanner(false)
    try {
      const sku = await stockInApi.resolveSku(code)
      if (canManualInput) {
        addItem({ sku, quantity: 1, price: Number(sku.price) || 0 })
        toast.success(`Ditambahkan: ${sku.Product?.name} ${skuLabel(sku)}`)
      } else {
        setScanConfirm({ sku })
      }
    } catch {
      toast.error(`SKU "${code}" tidak ditemukan`)
    }
  }

  const handleScanConfirm = ({ sku, quantity, price }) => {
    addItem({ sku, quantity, price })
    setScanConfirm(null)
    toast.success(`Ditambahkan: ${sku.Product?.name} ×${quantity}`)
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.WarehouseId) return toast.error('Pilih warehouse')
    if (!pendingItems.length) return toast.error('Tambahkan minimal 1 item')
    createMutation.mutate({
      date:        form.date,
      WarehouseId: Number(form.WarehouseId),
      note:        form.note || null,
      items:       pendingItems.map(p => ({ ProductSKUId: p.sku.id, quantity: p.quantity, price: p.price })),
    })
  }

  // ── VIEW MODE ────────────────────────────────────────────────────────────────
  if (!isNew) {
    if (isLoading) return <div className="p-8 text-slate-400 text-sm">Memuat…</div>
    if (!detail)   return <div className="p-8 text-red-500 text-sm">Stock IN tidak ditemukan.</div>

    const items      = detail.Stock_In_Items ?? []
    const grandTotal = detail.grandTotal ?? items.reduce((s, i) => s + Number(i.price) * i.quantity, 0)

    const handleExportExcel = () => {
      const headers = ['No', 'Produk', 'SKU', 'Varian', 'Qty', 'Unit', 'Harga Satuan (Rp)', 'Subtotal (Rp)']
      const rows = items.map((item, i) => {
        const sku  = item.ProductSKU
        const prod = sku?.Product
        const opts = sku?.ProductVariantOptions ?? []
        const variant = opts.map(o => o.value).join(' / ') || '-'
        return [
          i + 1, prod?.name ?? '—', sku?.sku_code ?? '—', variant,
          item.quantity, prod?.unit ?? '',
          Number(item.price), Number(item.price) * item.quantity,
        ]
      })
      exportExcel(`stock-in-${detail.id}-${new Date().toISOString().slice(0, 10)}`, { headers, rows, sheetName: 'Stock IN' })
    }

    return (
      <div className="px-6 py-6 max-w-5xl">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate('/stock-in')} className="p-1.5 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
            <ArrowLeft size={16} />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-slate-800">Stock IN #{detail.id}</h1>
            <p className="text-xs text-slate-400">
              {new Date(detail.date).toLocaleDateString('id-ID', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
            </p>
          </div>
          <button onClick={handleExportExcel} className="btn-secondary text-sm flex items-center gap-1.5">
            <FileSpreadsheet size={14} /> Export Excel
          </button>
        </div>

        <div className="card p-5 mb-5 grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          <div><p className="label mb-1">Warehouse</p><p className="font-semibold text-slate-700">{detail.Warehouse?.name ?? '—'}</p></div>
          <div><p className="label mb-1">Tanggal</p><p className="font-mono text-slate-600">{new Date(detail.date).toLocaleDateString('id-ID')}</p></div>
          <div><p className="label mb-1">Notes</p><p className="text-slate-500">{detail.note || '—'}</p></div>
        </div>

        <div className="card overflow-hidden mb-4">
          <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
            <PackagePlus size={13} className="text-red-700" />
            <span className="text-xs font-bold text-slate-600 uppercase tracking-wide">Items ({items.length})</span>
          </div>
          <ItemsTable items={items} canDelete={canDeleteItem} headerId={detail.id} />
          <div className="px-5 py-4 bg-slate-50 border-t border-slate-200 flex justify-end items-center gap-3">
            <span className="text-sm font-semibold text-slate-600">GRAND TOTAL</span>
            <span className="text-xl font-bold text-slate-900 font-mono">Rp {fmt(grandTotal)}</span>
          </div>
        </div>
      </div>
    )
  }

  // ── CREATE MODE ───────────────────────────────────────────────────────────────
  const grandTotal = pendingItems.reduce((s, p) => s + p.price * p.quantity, 0)

  return (
    <div className="px-6 py-6 max-w-4xl">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/stock-in')} className="p-1.5 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
          <ArrowLeft size={16} />
        </button>
        <div>
          <h1 className="text-lg font-bold text-slate-800">New Stock IN</h1>
          {!canManualInput && (
            <p className="text-xs text-amber-600 mt-0.5 flex items-center gap-1">
              <ScanLine size={11} /> Mode barcode — gunakan scan untuk menambah item
            </p>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="card p-5">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-4">Informasi Transaksi</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="label">Tanggal <span className="text-red-500">*</span></label>
              <input type="date" className="input" value={form.date}
                onChange={e => setForm(f => ({ ...f, date: e.target.value }))} required />
            </div>
            <div>
              <label className="label">Warehouse <span className="text-red-500">*</span></label>
              <select className="select" value={form.WarehouseId}
                onChange={e => setForm(f => ({ ...f, WarehouseId: e.target.value }))} required>
                <option value="">Pilih warehouse…</option>
                {warehouses?.data?.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Notes</label>
              <input className="input" placeholder="Catatan (opsional)…" value={form.note}
                onChange={e => setForm(f => ({ ...f, note: e.target.value }))} />
            </div>
          </div>
        </div>

        <div className="card overflow-hidden">
          <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <PackagePlus size={13} className="text-red-700" />
              <span className="text-xs font-bold text-slate-600 uppercase tracking-wide">Tambah Item</span>
            </div>
            <button type="button" onClick={() => setShowScanner(true)}
              className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-red-700 px-2.5 py-1 rounded hover:bg-red-50 border border-slate-200 hover:border-red-200 transition-colors">
              <ScanLine size={13} /> Scan QR
            </button>
          </div>

          <div className="p-4 border-b border-slate-100">
            {canManualInput
              ? <ProductSkuPicker onSelect={addItem} />
              : (
                <div className="flex items-center gap-3 py-3 px-1">
                  <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center flex-shrink-0">
                    <ScanLine size={18} className="text-amber-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-700">Wajib scan barcode</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Role Anda tidak memiliki izin input manual. Klik <strong>Scan QR</strong> untuk menambah item.
                    </p>
                  </div>
                </div>
              )
            }
          </div>

          <ItemsTable
            items={pendingItems}
            canDelete={true}
            onRemovePending={idx => setPending(p => p.filter((_, i) => i !== idx))}
          />

          {pendingItems.length > 0 && (
            <div className="px-5 py-4 bg-slate-50 border-t border-slate-200 flex justify-end items-center gap-3">
              <span className="text-sm font-semibold text-slate-600">GRAND TOTAL</span>
              <span className="text-xl font-bold text-slate-900 font-mono">Rp {fmt(grandTotal)}</span>
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <button type="button" onClick={() => navigate('/stock-in')} className="btn-secondary flex-1 justify-center">Batal</button>
          <button type="submit" disabled={createMutation.isPending} className="btn-primary flex-1 justify-center">
            <Save size={14} />
            {createMutation.isPending ? 'Menyimpan…' : 'Simpan Stock IN'}
          </button>
        </div>
      </form>

      {showScanner && (
        <QRScanner
          onScan={handleScan}
          onClose={() => setShowScanner(false)}
          hint={canManualInput ? 'Scan QR code SKU produk' : 'Scan barcode produk untuk menambah item'}
        />
      )}

      {scanConfirm && (
        <ScanConfirm
          sku={scanConfirm.sku}
          onConfirm={handleScanConfirm}
          onCancel={() => setScanConfirm(null)}
        />
      )}
    </div>
  )
}
