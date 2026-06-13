import { useState, useMemo, useRef, useEffect } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { stockInApi, stockInDraftApi, warehousesApi, productsApi, productSkusApi } from '../api'
import { useAuth } from '../context/AuthContext'
import QRScanner from '../components/QRScanner'
import SearchableSelect from '../components/SearchableSelect'
import { useExternalScanner } from '../hooks/useExternalScanner'
import { useCompanyGuard } from '../hooks/useCompanyGuard'
import CompanyRequiredBanner from '../components/CompanyRequiredBanner'
import toast from 'react-hot-toast'
import { exportExcel } from '../utils/exportExcel'
import {
  ArrowLeft, PackagePlus, ScanLine, Plus, Trash2,
  Save, ChevronDown, Package, X, FileSpreadsheet,
  ScanBarcode, Unplug, BookmarkCheck,
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
    onSelect({ sku: { ...selSku, Product: selProduct }, quantity: Number(qty), price: Number(price) || 0 })
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
          <SearchableSelect
            value={selSku?.id ?? ''}
            onChange={v => {
              const found = (skus ?? []).find(s => String(s.id) === String(v))
              if (found) selectSku(found)
            }}
            options={[
              { value: '', label: selProduct ? 'Pilih varian…' : '← Pilih produk dulu' },
              ...(skus ?? []).map(s => ({ value: s.id, label: `${skuLabel(s) || s.sku_code} — Rp ${fmt(s.price)}` })),
            ]}
            placeholder={selProduct ? 'Pilih varian…' : '← Pilih produk dulu'}
            disabled={!selProduct || !skus}
          />
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
function ItemRow({ item, canDelete, headerId, canViewValue }) {
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
      {canViewValue && <td className="td py-3 text-right font-mono text-sm text-slate-600">Rp {fmt(item.price)}</td>}
      {canViewValue && <td className="td py-3 text-right font-mono font-semibold text-slate-800">Rp {fmt(total)}</td>}
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
// draftMode=true  → items come from server draft (item.ProductSKU structure), onRemove(item.id)
// draftMode=false → view mode, uses ItemRow
function ItemsTable({ items, canDelete, headerId, onRemove, draftMode, removeLoading, canViewValue }) {
  const cols = 3 + (canViewValue ? 2 : 0) + (canDelete ? 1 : 0)
  return (
    <div className="overflow-x-auto">
    <table className="w-full min-w-[560px] text-sm">
      <thead>
        <tr className="bg-slate-50 border-b border-slate-200">
          <th className="th py-2 w-14">Foto</th>
          <th className="th py-2 text-left">Nama SKU</th>
          <th className="th py-2 text-right w-24">Qty</th>
          {canViewValue && <th className="th py-2 text-right w-36">Harga</th>}
          {canViewValue && <th className="th py-2 text-right w-36">Total</th>}
          {canDelete && <th className="th py-2 w-10"></th>}
        </tr>
      </thead>
      <tbody>
        {!items.length && (
          <tr><td colSpan={cols} className="td py-10 text-center text-slate-400">Belum ada item</td></tr>
        )}
        {items.map((item, idx) => {
          if (!draftMode) return <ItemRow key={item.id} item={item} canDelete={canDelete} headerId={headerId} canViewValue={canViewValue} />
          const sku  = item.ProductSKU
          const prod = sku?.Product
          return (
            <tr key={item.id ?? idx} className="tr border-b border-slate-100 hover:bg-slate-50/50">
              <td className="td py-3">
                {prod?.imageUrl
                  ? <img src={prod.imageUrl} className="w-10 h-10 rounded object-cover border border-slate-200" />
                  : <div className="w-10 h-10 rounded bg-slate-100 flex items-center justify-center"><Package size={14} className="text-slate-300" /></div>
                }
              </td>
              <td className="td py-3">
                <p className="font-semibold text-slate-800 leading-tight">{prod?.name}</p>
                <p className="text-xs text-slate-400">{skuLabel(sku)}</p>
              </td>
              <td className="td py-3 text-right font-bold text-slate-800">{item.quantity}</td>
              {canViewValue && <td className="td py-3 text-right font-mono text-slate-600">Rp {fmt(item.price)}</td>}
              {canViewValue && <td className="td py-3 text-right font-mono font-semibold text-slate-800">Rp {fmt(Number(item.price) * item.quantity)}</td>}
              <td className="td py-3">
                <button type="button" onClick={() => onRemove(item.id)}
                  disabled={removeLoading}
                  className="p-1.5 rounded text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40">
                  <Trash2 size={13} />
                </button>
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
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
  const { needsCompany } = useCompanyGuard()
  const [urlParams]     = useSearchParams()
  const draftIdParam    = urlParams.get('draftId')

  // Granular permission flags
  const canManualInput = hasPermission('stock.in.manual_input') || hasPermission('stock.manage')
  const canDeleteItem  = hasPermission('stock.in.delete_item')  || hasPermission('stock.manage')
  const canViewValue   = hasPermission('inventory.view_value')  || hasPermission('inventory.manage')

  // ── Draft (server-side) ──────────────────────────────────────────────────────
  const { data: draft, isLoading: draftLoading } = useQuery({
    queryKey: draftIdParam ? ['stock-in-draft', draftIdParam] : ['stock-in-draft'],
    queryFn:  draftIdParam
      ? () => stockInDraftApi.get(draftIdParam)
      : () => stockInDraftApi.ensure(),
    enabled:  isNew,
    staleTime: Infinity,
  })
  const draftId    = draft?.id
  const draftItems = draft?.Stock_In_Draft_Items ?? []

  // Local form, initialized from server draft once
  const formInitialized = useRef(false)
  const saveTimer       = useRef(null)
  const pageRef         = useRef(null)
  const [form, setForm] = useState({ date: fmtDate(), WarehouseId: '', note: '' })

  useEffect(() => {
    if (draft && !formInitialized.current) {
      formInitialized.current = true
      setForm({
        date:        draft.date        ? fmtDate(draft.date) : fmtDate(),
        WarehouseId: draft.WarehouseId ?? '',
        note:        draft.note        ?? '',
      })
    }
  }, [draft])

  const saveFormField = (field, value) => {
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      if (draftId) stockInDraftApi.update(draftId, { [field]: value }).catch(() => {})
    }, 600)
  }

  const hasDraft = isNew && (draftItems.length > 0 || !!form.WarehouseId)

  const [showScanner, setShowScanner]           = useState(false)
  const [scannerConnected, setScannerConnected] = useState(false)

  const { data: detail, isLoading } = useQuery({
    queryKey: ['stock-in', id],
    queryFn:  () => stockInApi.get(id),
    enabled:  !isNew && !!id,
  })

  const { data: warehouses } = useQuery({
    queryKey: ['warehouses', { limit: 100 }],
    queryFn:  () => warehousesApi.list({ limit: 100 }),
  })

  const draftQueryKey = draftIdParam ? ['stock-in-draft', draftIdParam] : ['stock-in-draft']

  const addItemMutation = useMutation({
    mutationFn: (data) => stockInDraftApi.addItem(draftId, data),
    // Gunakan setQueryData (bukan invalidateQueries) agar tidak ada refetch —
    // refetch menyebabkan re-render yang bisa menggeser focus keluar halaman,
    // sehingga scan berikutnya masuk ke DevTools console bukan ke page.
    onSuccess: (updatedDraft) => qc.setQueryData(draftQueryKey, updatedDraft),
    onError:   e => toast.error(e.response?.data?.message || 'Error'),
  })

  const removeItemMutation = useMutation({
    mutationFn: (itemId) => stockInDraftApi.removeItem(draftId, itemId),
    onSuccess:  ()       => qc.invalidateQueries({ queryKey: ['stock-in-draft'] }),
    onError:    e        => toast.error(e.response?.data?.message || 'Error'),
  })

  const createMutation = useMutation({
    mutationFn: () => stockInDraftApi.submit(draftId, {
      date:        form.date,
      WarehouseId: Number(form.WarehouseId),
      note:        form.note || null,
    }),
    onSuccess: (data) => {
      qc.removeQueries({ queryKey: ['stock-in-draft'] })
      qc.invalidateQueries({ queryKey: ['stock-in-draft-current'] })
      qc.invalidateQueries({ queryKey: ['stock-in'] })
      toast.success('Stock IN berhasil dibuat')
      navigate(`/stock-in/${data.id}`, { replace: true })
    },
    onError: e => toast.error(e.response?.data?.message || 'Error'),
  })

  const cancelMutation = useMutation({
    mutationFn: () => stockInDraftApi.cancel(draftId),
    onSuccess: () => {
      qc.removeQueries({ queryKey: ['stock-in-draft'] })
      qc.invalidateQueries({ queryKey: ['stock-in-draft-current'] })
      navigate('/stock-in')
    },
    onError: () => navigate('/stock-in'),
  })

  const addItem = ({ sku, quantity, price }) => {
    if (!draftId) return toast.error('Draft belum siap, coba lagi')
    addItemMutation.mutate({ ProductSKUId: sku.id, quantity, price: price || 0 })
  }

  const handleScan = async (code) => {
    try {
      const sku   = await stockInApi.resolveSku(code)
      const label = skuLabel(sku)
      addItem({ sku, quantity: 1, price: Number(sku.price) || 0 })
      toast.success(`${sku.Product?.name ?? code}${label ? ` · ${label}` : ''} +1`)
    } catch {
      toast.error(`SKU "${code}" tidak ditemukan`)
    }
    // Kembalikan focus ke halaman agar scan berikutnya tidak jatuh ke DevTools console
    pageRef.current?.focus()
  }

  useExternalScanner(handleScan, isNew && scannerConnected)

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.WarehouseId) return toast.error('Pilih warehouse')
    if (!draftItems.length) return toast.error('Tambahkan minimal 1 item')
    createMutation.mutate()
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
          <div>
            <p className="label mb-1">Total Produk</p>
            <p className="font-bold text-slate-800">{items.length} <span className="font-normal text-slate-400">item</span></p>
          </div>
          <div>
            <p className="label mb-1">Total Qty</p>
            <p className="font-bold text-slate-800">{fmt(items.reduce((s, i) => s + i.quantity, 0))} <span className="font-normal text-slate-400">unit</span></p>
          </div>
          {canViewValue && (
            <div>
              <p className="label mb-1">Grand Total</p>
              <p className="font-bold text-slate-800 font-mono">Rp {fmt(grandTotal)}</p>
            </div>
          )}
          <div>
            <p className="label mb-1">Oleh</p>
            <p className="font-semibold text-slate-700">{detail.User?.name ?? '—'}</p>
          </div>
        </div>

        <div className="card mb-4">
          <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
            <PackagePlus size={13} className="text-red-700" />
            <span className="text-xs font-bold text-slate-600 uppercase tracking-wide">Items ({items.length})</span>
          </div>
          <ItemsTable items={items} canDelete={canDeleteItem} headerId={detail.id} draftMode={false} canViewValue={canViewValue} />
          {canViewValue && (
            <div className="px-5 py-4 bg-slate-50 border-t border-slate-200 flex justify-end items-center gap-3">
              <span className="text-sm font-semibold text-slate-600">GRAND TOTAL</span>
              <span className="text-xl font-bold text-slate-900 font-mono">Rp {fmt(grandTotal)}</span>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── CREATE MODE ───────────────────────────────────────────────────────────────
  const grandTotal = draftItems.reduce((s, p) => s + Number(p.price) * p.quantity, 0)

  if (needsCompany) return (
    <div className="px-6 py-6 max-w-4xl space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/stock-in')} className="p-1.5 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
          <ArrowLeft size={16} />
        </button>
        <h1 className="text-lg font-bold text-slate-800">New Stock IN</h1>
      </div>
      <CompanyRequiredBanner action="membuat transaksi stock in" />
    </div>
  )

  return (
    <div className="px-6 py-6 max-w-4xl outline-none" ref={pageRef} tabIndex={-1}>
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/stock-in')} className="p-1.5 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
          <ArrowLeft size={16} />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold text-slate-800">New Stock IN</h1>
            {hasDraft && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                📋 Draft aktif
              </span>
            )}
          </div>
          {!canManualInput && (
            <p className="text-xs text-amber-600 mt-0.5 flex items-center gap-1">
              <ScanLine size={11} /> Mode barcode — gunakan scan untuk menambah item
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => {
            setScannerConnected(v => !v)
            if (!scannerConnected) toast.success('Scanner eksternal terhubung', { icon: '🔌' })
            else toast('Scanner diputus', { icon: '🔌' })
          }}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
            scannerConnected
              ? 'bg-green-50 border-green-300 text-green-700 hover:bg-green-100'
              : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-700'
          }`}
        >
          {scannerConnected
            ? <><span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" /> Connected</>
            : <><ScanBarcode size={14} /> Hubungkan Scanner</>
          }
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="card p-5">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-4">Informasi Transaksi</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="label">Tanggal <span className="text-red-500">*</span></label>
              <input type="date" className="input" value={form.date}
                onChange={e => { setForm(f => ({ ...f, date: e.target.value })); saveFormField('date', e.target.value) }} required />
            </div>
            <div>
              <label className="label">Warehouse <span className="text-red-500">*</span></label>
              <SearchableSelect
                value={form.WarehouseId}
                onChange={v => { setForm(f => ({ ...f, WarehouseId: v })); saveFormField('WarehouseId', v) }}
                options={[{ value: '', label: 'Pilih warehouse…' }, ...(warehouses?.data ?? []).map(w => ({ value: w.id, label: w.name }))]}
                placeholder="Pilih warehouse…"
                required
              />
            </div>
            <div>
              <label className="label">Notes</label>
              <input className="input" placeholder="Catatan (opsional)…" value={form.note}
                onChange={e => { setForm(f => ({ ...f, note: e.target.value })); saveFormField('note', e.target.value) }} />
            </div>
          </div>
        </div>

        <div className="card">
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

          {draftLoading
            ? <p className="text-center text-slate-400 text-sm py-10">Memuat draft…</p>
            : <ItemsTable
                items={draftItems}
                canDelete={true}
                draftMode={true}
                onRemove={itemId => removeItemMutation.mutate(itemId)}
                removeLoading={removeItemMutation.isPending}
                canViewValue={canViewValue}
              />
          }

          {draftItems.length > 0 && canViewValue && (
            <div className="px-5 py-4 bg-slate-50 border-t border-slate-200 flex justify-end items-center gap-3">
              <span className="text-sm font-semibold text-slate-600">GRAND TOTAL</span>
              <span className="text-xl font-bold text-slate-900 font-mono">Rp {fmt(grandTotal)}</span>
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <button type="button" onClick={() => cancelMutation.mutate()}
            disabled={cancelMutation.isPending}
            className="flex-1 justify-center flex items-center gap-2 px-4 py-2 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 text-sm font-medium transition-colors disabled:opacity-50">
            <X size={14} /> Batalkan
          </button>
          <button type="button"
            onClick={async () => {
              if (draftId) {
                clearTimeout(saveTimer.current)
                await stockInDraftApi.update(draftId, { date: form.date, WarehouseId: form.WarehouseId || null, note: form.note || null }).catch(() => {})
              }
              qc.invalidateQueries({ queryKey: ['stock-in-draft-current'] })
              navigate('/stock-in')
            }}
            className="flex-1 justify-center flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm font-medium transition-colors">
            <BookmarkCheck size={14} /> Simpan Draft
          </button>
          <button type="submit" disabled={createMutation.isPending || draftLoading} className="btn-primary flex-1 justify-center">
            <Save size={14} />
            {createMutation.isPending ? 'Menyimpan…' : 'Simpan Stock IN'}
          </button>
        </div>
      </form>

      {showScanner && (
        <QRScanner
          onScan={handleScan}
          onClose={() => setShowScanner(false)}
          autoClose={false}
          hint="Scan semua item lalu tutup & simpan"
        />
      )}
    </div>
  )
}
