import { useState, useMemo, useRef, useEffect } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { stockOutApi, stockOutDraftApi, warehousesApi, stockInApi, productsApi, productSkusApi, stocksApi } from '../api'
import { useAuth } from '../context/AuthContext'
import QRScanner from '../components/QRScanner'
import SearchableSelect from '../components/SearchableSelect'
import { useExternalScanner } from '../hooks/useExternalScanner'
import { useCompanyGuard } from '../hooks/useCompanyGuard'
import CompanyRequiredBanner from '../components/CompanyRequiredBanner'
import toast from 'react-hot-toast'
import { ArrowLeft, PackageMinus, ScanLine, Plus, Trash2, Save, ScanBarcode, ChevronDown, Package, FileSpreadsheet, BookmarkCheck, X } from 'lucide-react'
import { exportExcel } from '../utils/exportExcel'

const fmt = (n) => Number(n ?? 0).toLocaleString('id-ID')

const PURPOSES = [
  'Penjualan',
  'Endorse',
  'Photoshoot',
  'R&D',
  'Pemakaian Internal',
  'Hadiah / Gift',
  'Sample',
  'Retur Vendor',
  'Lainnya',
]

const skuLabel = (sku) => {
  const opts = sku?.ProductVariantOptions ?? []
  if (!opts.length) return sku?.sku_code ?? ''
  return opts.map(o => o.value).join(' / ')
}

const fmtDate = (d) => d ? new Date(d).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10)

const EMPTY_FORM = { warehouseId: '', purpose: '', purposeDetail: '', note: '', date: fmtDate(), items: [] }

// ── Product → SKU picker untuk Stock OUT ────────────────────────────────────────
function ProductSkuPicker({ onSelect, warehouseId, stocks }) {
  const [search, setSearch]         = useState('')
  const [open, setOpen]             = useState(false)
  const [selProduct, setSelProduct] = useState(null)
  const [selSku, setSelSku]         = useState(null)
  const [qty, setQty]               = useState(1)
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

  const getAvail = (productId) => {
    if (!stocks?.data) return null              // belum dimuat — jangan tampilkan badge
    const found = stocks.data.find(s => String(s.ProductId) === String(productId))
    return found?.quantity ?? 0                 // tidak ada record = 0 stok
  }

  const selectProduct = (prod) => {
    setSelProduct(prod)
    setSearch(prod.name)
    setSelSku(null)
    setOpen(false)
    inputRef.current?.blur()
  }

  const handleAdd = () => {
    if (!selSku) return toast.error('Pilih SKU / varian terlebih dahulu')
    if (!qty || Number(qty) <= 0) return toast.error('Qty harus lebih dari 0')
    const avail = selSku.qty ?? 0
    if (Number(qty) > avail) {
      toast(`Stok akan menjadi negatif. Tersedia: ${avail}`, { icon: '⚠️' })
    }
    onSelect({
      skuId:        selSku.id,
      productId:    selProduct.id,
      productName:  selProduct.name,
      imageUrl:     selProduct.imageUrl ?? null,
      variantLabel: skuLabel(selSku),
      quantity:     Number(qty),
      available:    avail,
    })
    setSearch(''); setSelProduct(null); setSelSku(null); setQty(1)
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
              {filtered.map(p => {
                const avail = getAvail(p.id)
                return (
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
                    <span className="text-sm text-slate-800 flex-1 truncate">{p.name}</span>
                    {avail !== null && (
                      <span className={`text-xs font-mono shrink-0 ${avail === 0 ? 'text-red-400' : 'text-slate-400'}`}>
                        {avail} stok
                      </span>
                    )}
                  </button>
                )
              })}
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
              if (found) setSelSku(found)
            }}
            options={[
              { value: '', label: selProduct ? 'Pilih varian…' : '← Pilih produk dulu' },
              ...(skus ?? []).map(s => ({
                value: s.id,
                label: `${skuLabel(s) || s.sku_code} — stok: ${s.qty ?? 0}`,
              })),
            ]}
            placeholder={selProduct ? 'Pilih varian…' : '← Pilih produk dulu'}
            disabled={!selProduct || !skus}
          />
        </div>
      </div>

      {/* Qty + Add row */}
      {selSku && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-lg px-3 py-2.5">
          {selProduct?.imageUrl
            ? <img src={selProduct.imageUrl} className="w-9 h-9 rounded object-cover flex-shrink-0 border border-slate-200" />
            : <div className="w-9 h-9 rounded bg-slate-100 flex items-center justify-center flex-shrink-0"><Package size={14} className="text-slate-300" /></div>
          }
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-800 truncate">{selProduct?.name}</p>
            <p className="text-xs text-slate-500">{skuLabel(selSku)}</p>
            {selSku != null && (
              <p className={`text-xs font-medium ${(selSku.qty ?? 0) === 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                Stok tersedia: {selSku.qty ?? 0}
              </p>
            )}
          </div>
          <input
            type="number" min="1" placeholder="Qty"
            className="input w-20 text-center"
            value={qty}
            onChange={e => setQty(e.target.value)}
          />
          <button type="button" onClick={handleAdd} className="btn-primary flex-shrink-0">
            <Plus size={14} /> Tambah
          </button>
        </div>
      )}
    </div>
  )
}

export default function StockOutDetail() {
  const { id }     = useParams()
  const navigate   = useNavigate()
  const qc         = useQueryClient()
  const { hasPermission } = useAuth()
  const isNew      = !id || id === 'new'
  const { needsCompany } = useCompanyGuard()
  const [urlParams] = useSearchParams()
  const draftIdParam = urlParams.get('draftId')

  const canManualOutput = hasPermission('stock.out.manual_input') || hasPermission('stock.manage')
  const canScanOut      = hasPermission('stock.out.scan')         || hasPermission('stock.manage')
  const canViewValue    = hasPermission('inventory.view_value')   || hasPermission('inventory.manage')

  // ── Draft (server-side) ──────────────────────────────────────────────────────
  const { data: draft, isLoading: draftLoading } = useQuery({
    queryKey: draftIdParam ? ['stock-out-draft', draftIdParam] : ['stock-out-draft'],
    queryFn:  draftIdParam
      ? () => stockOutDraftApi.get(draftIdParam)
      : () => stockOutDraftApi.ensure(),
    enabled:           isNew,
    staleTime:         Infinity,
    structuralSharing: false,
  })
  const draftId    = draft?.id
  const draftItems = draft?.Stock_Out_Draft_Items ?? []

  const pageRef         = useRef(null)
  const scanGrabRef     = useRef(null) // hidden input untuk cegah DevTools capture scanner
  const formInitialized = useRef(false)
  const saveTimer       = useRef(null)
  const [form, setForm] = useState(EMPTY_FORM)

  useEffect(() => {
    if (draft && !formInitialized.current) {
      formInitialized.current = true
      setForm(f => ({
        ...f,
        warehouseId: draft.WarehouseId ?? '',
        purpose:     draft.purpose     ?? '',
        note:        draft.note        ?? '',
        date:        draft.date        ? fmtDate(draft.date) : fmtDate(),
      }))
      if (draft.Stock_Out_Draft_Items?.length > 0 || draft.WarehouseId) {
        toast('Draft session dipulihkan', { icon: '📋', duration: 3000 })
      }
    }
  }, [draft])

  const saveFormField = (field, value) => {
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      if (draftId) stockOutDraftApi.update(draftId, { [field]: value }).catch(() => {})
    }, 600)
  }

  const hasDraft = isNew && (draftItems.length > 0 || !!form.warehouseId)

  const [showScanner, setShowScanner]               = useState(false)
  const [scannerConnected, setScannerConnected]     = useState(false)

  const { data: detail, isLoading } = useQuery({
    queryKey: ['stock-out', id],
    queryFn:  () => stockOutApi.get(id),
    enabled:  !isNew && !!id,
  })

  const { data: warehouses } = useQuery({
    queryKey: ['warehouses', { limit: 100 }],
    queryFn:  () => warehousesApi.list({ limit: 100 }),
    enabled:  isNew,
  })

  const { data: stocks } = useQuery({
    queryKey: ['stocks', { WarehouseId: form.warehouseId, limit: 200 }],
    queryFn:  () => stocksApi.list({ WarehouseId: form.warehouseId, limit: 200 }),
    enabled:  !!form.warehouseId && isNew,
  })

  // Ketika scanner aktif, jaga hidden input selalu terfokus.
  useEffect(() => {
    if (!scannerConnected || !isNew) return
    const input = scanGrabRef.current
    if (!input) return
    input.focus()
    const onBlur = () => requestAnimationFrame(() => {
      if (!document.activeElement || document.activeElement === document.body) {
        input.focus()
      }
    })
    input.addEventListener('blur', onBlur)
    return () => input.removeEventListener('blur', onBlur)
  }, [scannerConnected, isNew])

  const draftQueryKey = draftIdParam ? ['stock-out-draft', draftIdParam] : ['stock-out-draft']

  const addItemMutation = useMutation({
    mutationFn: (data) => stockOutDraftApi.addItem(draftId, data),
    onSuccess:  ()     => qc.invalidateQueries({ queryKey: draftQueryKey }),
    onError:    e      => toast.error(e.response?.data?.message || 'Error'),
  })

  const removeItemMutation = useMutation({
    mutationFn: (itemId) => stockOutDraftApi.removeItem(draftId, itemId),
    onSuccess:  ()       => qc.invalidateQueries({ queryKey: draftQueryKey }),
    onError:    e        => toast.error(e.response?.data?.message || 'Error'),
  })

  const updateItemQtyMutation = useMutation({
    mutationFn: ({ itemId, quantity }) => stockOutDraftApi.updateItem(draftId, itemId, { quantity }),
    onSuccess:  ()                      => qc.invalidateQueries({ queryKey: draftQueryKey }),
  })

  const createMutation = useMutation({
    mutationFn: () => {
      const purpose = form.purpose === 'Lainnya' ? `Lainnya: ${form.purposeDetail.trim()}` : form.purpose
      return stockOutDraftApi.submit(draftId, {
        WarehouseId: form.warehouseId,
        purpose,
        date: form.date,
        note: form.note,
      })
    },
    onSuccess: (data) => {
      qc.removeQueries({ queryKey: ['stock-out-draft'] })
      qc.invalidateQueries({ queryKey: ['stock-out-draft-current'] })
      qc.invalidateQueries({ queryKey: ['stock-out'] })
      qc.invalidateQueries({ queryKey: ['stocks'] })
      toast.success('Stock OUT berhasil dicatat')
      navigate(`/stock-out/${data.id}`, { replace: true })
    },
    onError: e => toast.error(e.response?.data?.message || 'Error'),
  })

  const cancelMutation = useMutation({
    mutationFn: () => stockOutDraftApi.cancel(draftId),
    onSuccess: () => {
      qc.removeQueries({ queryKey: ['stock-out-draft'] })
      qc.invalidateQueries({ queryKey: ['stock-out-draft-current'] })
      navigate('/stock-out')
    },
    onError: () => navigate('/stock-out'),
  })

  const addItem = ({ skuId, productId, quantity }) => {
    if (!draftId) return toast.error('Draft belum siap, coba lagi')
    addItemMutation.mutate({
      ProductSKUId: skuId   ? Number(skuId)   : undefined,
      ProductId:    productId ? Number(productId) : undefined,
      quantity,
    })
  }

  const handleScan = async (code) => {
    setShowScanner(false)
    if (!form.warehouseId) return toast.error('Pilih warehouse terlebih dahulu')
    try {
      const sku       = await stockInApi.resolveSku(code)
      if (!draftId) return toast.error('Draft belum siap, coba lagi')
      const updated = await stockOutDraftApi.addItem(draftId, {
        ProductSKUId: sku.id ? Number(sku.id) : undefined,
        ProductId:    sku.ProductId ? Number(sku.ProductId) : (sku.Product?.id ? Number(sku.Product.id) : undefined),
        quantity: 1,
      })
      qc.setQueryData(draftQueryKey, updated)
      const name  = sku.Product?.name ?? code
      const label = skuLabel(sku)
      toast.success(`${name}${label ? ` · ${label}` : ''} +1`)
    } catch {
      toast.error(`SKU "${code}" tidak ditemukan`)
    }
    scanGrabRef.current?.focus()
  }

  useExternalScanner(handleScan, isNew && scannerConnected && canScanOut)

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.warehouseId) return toast.error('Pilih warehouse')
    if (!form.purpose) return toast.error('Pilih tujuan stock out')
    if (form.purpose === 'Lainnya' && !form.purposeDetail.trim()) return toast.error('Jelaskan tujuan lainnya')
    if (!draftItems.length) return toast.error('Tambahkan minimal 1 item')
    createMutation.mutate()
  }

  // ── VIEW MODE ─────────────────────────────────────────────────────────────────
  if (!isNew) {
    if (isLoading) return <div className="p-8 text-slate-400 text-sm">Memuat…</div>
    if (!detail)   return <div className="p-8 text-red-500 text-sm">Stock OUT tidak ditemukan.</div>

    const items = detail.movements ?? detail.Stock_Out_Items ?? detail.items ?? []

    const handleExportExcel = () => {
      const headers = ['No', 'Produk', 'SKU', 'Varian', 'Qty', 'Tujuan', 'Gudang', 'Tanggal']
      const rows = items.map((item, i) => {
        const sku     = item.ProductSKU
        const opts    = sku?.ProductVariantOptions ?? []
        const variant = opts.map(o => o.value).join(' / ') || '—'
        return [
          i + 1,
          item.Product?.name ?? '—',
          sku?.sku_code ?? '—',
          variant,
          item.quantity,
          detail.purpose ?? '—',
          detail.Warehouse?.name ?? '—',
          new Date(detail.date ?? detail.createdAt).toLocaleDateString('id-ID'),
        ]
      })
      exportExcel(`stock-out-${detail.id}-${new Date().toISOString().slice(0, 10)}`, { headers, rows, sheetName: 'Stock OUT' })
    }

    return (
      <div className="px-6 py-6 max-w-4xl">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate('/stock-out')} className="p-1.5 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
            <ArrowLeft size={16} />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-slate-800">Stock OUT #{detail.id}</h1>
            <p className="text-xs text-slate-400">
              {new Date(detail.date ?? detail.createdAt).toLocaleDateString('id-ID', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
            </p>
          </div>
          {items.length > 0 && (
            <button onClick={handleExportExcel} className="btn-secondary text-sm flex items-center gap-1.5">
              <FileSpreadsheet size={14} /> Export Excel
            </button>
          )}
        </div>

        <div className="card p-5 mb-5 grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
          <div><p className="label mb-1">Warehouse</p><p className="font-semibold text-slate-700">{detail.Warehouse?.name ?? '—'}</p></div>
          <div><p className="label mb-1">Tanggal</p><p className="font-mono text-slate-600">{new Date(detail.date ?? detail.createdAt).toLocaleDateString('id-ID')}</p></div>
          <div>
            <p className="label mb-1">Tujuan</p>
            <span className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold bg-violet-50 text-violet-700 border border-violet-100">
              {detail.purpose ?? '—'}
            </span>
          </div>
          <div><p className="label mb-1">Catatan</p><p className="text-slate-500">{detail.notes || detail.note || '—'}</p></div>
          <div>
            <p className="label mb-1">Total Produk</p>
            <p className="font-bold text-slate-800">{items.length} <span className="font-normal text-slate-400">item</span></p>
          </div>
          <div>
            <p className="label mb-1">Total Qty</p>
            <p className="font-bold text-slate-800">{fmt(items.reduce((s, i) => s + (i.quantity ?? 0), 0))} <span className="font-normal text-slate-400">unit</span></p>
          </div>
          <div>
            <p className="label mb-1">Oleh</p>
            <p className="font-semibold text-slate-700">{detail.User?.name ?? '—'}</p>
          </div>
          {canViewValue && (
            <div>
              <p className="label mb-1">Grand Total</p>
              <p className="font-bold text-slate-800 font-mono">Rp {fmt(detail.grandTotal ?? 0)}</p>
            </div>
          )}
        </div>

        {items.length > 0 && (
          <div className="card">
            <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
              <PackageMinus size={13} className="text-danger" />
              <span className="text-xs font-bold text-slate-600 uppercase tracking-wide">Items ({items.length})</span>
            </div>
            <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="th py-2 text-left">Produk</th>
                  <th className="th py-2 text-left">Varian / SKU</th>
                  <th className="th py-2 text-right w-24">Qty</th>
                  {canViewValue && <th className="th py-2 text-right w-36">Harga Satuan</th>}
                  {canViewValue && <th className="th py-2 text-right w-36">Subtotal</th>}
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => {
                  const sku     = item.ProductSKU
                  const opts    = sku?.ProductVariantOptions ?? []
                  const variant = opts.map(o => o.value).join(' / ') || sku?.sku_code || '—'
                  const price   = Number(sku?.price ?? 0)
                  return (
                    <tr key={item.id ?? idx} className="tr border-b border-slate-100 hover:bg-slate-50/50">
                      <td className="td py-3">
                        <p className="font-semibold text-slate-800">{item.Product?.name ?? `#${item.ProductId}`}</p>
                        <p className="text-xs font-mono text-slate-400">{item.Product?.sku}</p>
                      </td>
                      <td className="td py-3">
                        <span className="text-sm text-slate-600">{sku ? variant : '—'}</span>
                      </td>
                      <td className="td py-3 text-right font-mono font-bold text-danger">{fmt(item.quantity)}</td>
                      {canViewValue && <td className="td py-3 text-right font-mono text-slate-500">Rp {fmt(price)}</td>}
                      {canViewValue && <td className="td py-3 text-right font-mono font-semibold text-slate-800">Rp {fmt(price * item.quantity)}</td>}
                    </tr>
                  )
                })}
              </tbody>
            </table>
            </div>
            {canViewValue && (
              <div className="px-5 py-4 bg-slate-50 border-t border-slate-200 flex justify-end items-center gap-3">
                <span className="text-sm font-semibold text-slate-600">GRAND TOTAL</span>
                <span className="text-xl font-bold text-slate-900 font-mono">Rp {fmt(detail.grandTotal ?? 0)}</span>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  // ── CREATE MODE ───────────────────────────────────────────────────────────────
  if (needsCompany) return (
    <div className="px-6 py-6 max-w-4xl space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/stock-out')} className="p-1.5 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
          <ArrowLeft size={16} />
        </button>
        <h1 className="text-lg font-bold text-slate-800">New Stock OUT</h1>
      </div>
      <CompanyRequiredBanner action="membuat transaksi stock out" />
    </div>
  )

  return (
    <div className="px-6 py-6 max-w-4xl outline-none" ref={pageRef} tabIndex={-1}>
      {scannerConnected && (
        <input
          ref={scanGrabRef}
          aria-hidden="true"
          tabIndex={-1}
          style={{ position: 'fixed', opacity: 0, width: 0, height: 0, top: 0, left: 0, pointerEvents: 'none' }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              const code = e.currentTarget.value.trim()
              e.currentTarget.value = ''
              if (code.length > 2) handleScan(code)
            }
          }}
          onChange={() => {}}
        />
      )}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/stock-out')} className="p-1.5 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
          <ArrowLeft size={16} />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold text-slate-800">New Stock OUT</h1>
            {hasDraft && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                📋 Draft aktif
              </span>
            )}
          </div>
          {!canManualOutput && (
            <p className="text-xs text-amber-600 mt-0.5 flex items-center gap-1">
              <ScanLine size={11} /> Mode barcode — gunakan scan untuk menambah item
            </p>
          )}
        </div>
        {canScanOut && (
          <button
            type="button"
            onClick={(e) => {
              e.currentTarget.blur()
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
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="card p-5">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-4">Informasi Transaksi</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Warehouse <span className="text-red-500">*</span></label>
              <SearchableSelect
                value={form.warehouseId}
                onChange={v => { setForm(f => ({ ...f, warehouseId: v })); saveFormField('WarehouseId', v) }}
                options={[{ value: '', label: 'Pilih warehouse…' }, ...(warehouses?.data ?? []).map(w => ({ value: w.id, label: w.name }))]}
                placeholder="Pilih warehouse…"
                required
              />
            </div>
            <div>
              <label className="label">Tujuan <span className="text-red-500">*</span></label>
              <select
                className="input"
                value={form.purpose}
                onChange={e => { setForm(f => ({ ...f, purpose: e.target.value, purposeDetail: '' })); saveFormField('purpose', e.target.value) }}
                required
              >
                <option value="">Pilih tujuan…</option>
                {PURPOSES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            {form.purpose === 'Lainnya' && (
              <div className="sm:col-span-2">
                <label className="label">Jelaskan tujuan <span className="text-red-500">*</span></label>
                <input
                  className="input"
                  placeholder="Contoh: Sponsorship event, Donasi, dll…"
                  value={form.purposeDetail}
                  onChange={e => setForm(f => ({ ...f, purposeDetail: e.target.value }))}
                />
              </div>
            )}
            <div>
              <label className="label">Tanggal <span className="text-red-500">*</span></label>
              <input type="date" className="input" value={form.date}
                onChange={e => { setForm(f => ({ ...f, date: e.target.value })); saveFormField('date', e.target.value) }} required />
            </div>
            <div>
              <label className="label">Catatan</label>
              <input className="input" placeholder="Catatan (opsional)…" value={form.note}
                onChange={e => { setForm(f => ({ ...f, note: e.target.value })); saveFormField('note', e.target.value) }} />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
            <PackageMinus size={13} className="text-danger flex-shrink-0" />
            <span className="text-xs font-bold text-slate-600 uppercase tracking-wide">Items</span>
            {!form.warehouseId && <span className="text-xs text-slate-400 truncate">— pilih warehouse dulu</span>}
            {canScanOut && (
              <button
                type="button"
                onClick={() => setShowScanner(true)}
                disabled={!form.warehouseId}
                className="ml-auto flex-shrink-0 flex items-center gap-1.5 text-xs text-slate-500 hover:text-red-700 px-2.5 py-1.5 rounded hover:bg-red-50 border border-slate-200 hover:border-red-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ScanLine size={13} /> Scan QR
              </button>
            )}
          </div>

          {/* Input row */}
          <div className="p-4 border-b border-slate-100">
            {canManualOutput ? (
              !form.warehouseId ? (
                <p className="text-sm text-slate-400 py-2">← Pilih warehouse terlebih dahulu</p>
              ) : (
                <ProductSkuPicker
                  onSelect={addItem}
                  warehouseId={form.warehouseId}
                  stocks={stocks}
                />
              )
            ) : (
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
            )}
          </div>

          {/* Items list */}
          {draftLoading ? (
            <p className="text-center text-slate-400 text-sm py-10">Memuat draft…</p>
          ) : !draftItems.length ? (
            <p className="text-center text-slate-400 text-sm py-10">Belum ada item</p>
          ) : (
            <div className="overflow-x-auto">
            <table className="w-full min-w-[440px] text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="th py-2 w-14">Foto</th>
                  <th className="th py-2 text-left">Produk</th>
                  <th className="th py-2 text-left">Varian / SKU</th>
                  <th className="th py-2 text-right w-28">Qty</th>
                  <th className="th py-2 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {draftItems.map((it) => {
                  const sku     = it.ProductSKU
                  const prod    = sku?.Product ?? it.Product
                  const variant = sku ? skuLabel(sku) : '—'
                  return (
                    <tr key={it.id} className="tr border-b border-slate-50">
                      <td className="td py-2">
                        {prod?.imageUrl
                          ? <img src={prod.imageUrl} className="w-10 h-10 rounded object-cover border border-slate-200" />
                          : <div className="w-10 h-10 rounded bg-slate-100 flex items-center justify-center"><Package size={14} className="text-slate-300" /></div>
                        }
                      </td>
                      <td className="td py-2 font-medium text-slate-800">{prod?.name ?? '—'}</td>
                      <td className="td py-2 text-slate-500 text-xs">{variant}</td>
                      <td className="td py-1.5 text-right">
                        {canManualOutput ? (
                          <input
                            type="number" min="1"
                            defaultValue={it.quantity}
                            onBlur={e => {
                              const val = Number(e.target.value)
                              if (val >= 1 && val !== it.quantity) updateItemQtyMutation.mutate({ itemId: it.id, quantity: val })
                            }}
                            className="w-20 text-right font-mono font-semibold text-danger border border-slate-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:border-brand/50 bg-white"
                          />
                        ) : (
                          <span className="font-mono font-semibold text-danger">{it.quantity}</span>
                        )}
                      </td>
                      <td className="td py-2">
                        <button type="button"
                          onClick={() => removeItemMutation.mutate(it.id)}
                          disabled={removeItemMutation.isPending}
                          className="p-1 text-slate-300 hover:text-danger transition-colors disabled:opacity-40">
                          <Trash2 size={12} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
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
                const purpose = form.purpose === 'Lainnya' ? `Lainnya: ${form.purposeDetail?.trim()}` : form.purpose
                await stockOutDraftApi.update(draftId, { date: form.date, WarehouseId: form.warehouseId || null, purpose: purpose || null, note: form.note || null }).catch(() => {})
              }
              qc.invalidateQueries({ queryKey: ['stock-out-draft-current'] })
              navigate('/stock-out')
            }}
            className="flex-1 justify-center flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm font-medium transition-colors">
            <BookmarkCheck size={14} /> Simpan Draft
          </button>
          <button type="submit" disabled={createMutation.isPending || draftLoading} className="btn-primary flex-1 justify-center">
            <Save size={14} />
            {createMutation.isPending ? 'Menyimpan…' : 'Submit Stock OUT'}
          </button>
        </div>
      </form>

      {showScanner && (
        <QRScanner
          onScan={handleScan}
          onClose={() => setShowScanner(false)}
          hint="Scan QR / barcode SKU produk untuk Stock OUT"
        />
      )}
    </div>
  )
}
