import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { opnameSessionsApi, opnameItemsApi, stocksApi, stockInApi } from '../api'
import { useAuth } from '../context/AuthContext'
import QRScanner from '../components/QRScanner'
import { useExternalScanner } from '../hooks/useExternalScanner'
import toast from 'react-hot-toast'
import { exportExcel } from '../utils/exportExcel'
import { ArrowLeft, ClipboardList, ScanLine, Search, X, CheckCircle, FileSpreadsheet, ScanBarcode } from 'lucide-react'

const skuLabel = (sku) => {
  const opts = sku?.ProductVariantOptions ?? []
  if (!opts.length) return sku?.sku_code ?? ''
  return opts.map(o => o.value).join(' / ')
}

export default function OpnameDetail() {
  const { id }   = useParams()
  const navigate = useNavigate()
  const qc       = useQueryClient()
  const { hasPermission } = useAuth()

  const canManual = hasPermission('stock.opname.manual_input')
  const canScan   = hasPermission('stock.opname.scan')

  const [localItems, setLocalItems]             = useState([])
  const [fillMode, setFillMode]                 = useState('manual')
  const [search, setSearch]                     = useState('')
  const [showScanner, setShowScanner]           = useState(false)
  const [scannerConnected, setScannerConnected] = useState(false)
  const [fillInitialized, setFillInitialized]   = useState(false)
  const [confirmMode, setConfirmMode]           = useState(null) // 'submit' | 'cancel' | 'close'

  const { data: session, isLoading: sessionLoading } = useQuery({
    queryKey: ['opname-session', id],
    queryFn:  () => opnameSessionsApi.get(id),
    enabled:  !!id,
  })

  const warehouseId = session?.WarehouseId ?? session?.warehouseId

  const { data: stocks, isLoading: stocksLoading } = useQuery({
    queryKey: ['stocks-opname', { WarehouseId: warehouseId }],
    queryFn:  () => stocksApi.list({ WarehouseId: warehouseId, limit: 500 }),
    enabled:  !!warehouseId && session?.status === 'open',
  })

  const { data: existingItems } = useQuery({
    queryKey: ['opname-items', id],
    queryFn:  () => opnameItemsApi.list({ SessionId: id, limit: 500 }),
    enabled:  !!id,
  })

  const filteredStocks = useMemo(() => {
    if (!stocks?.data) return []
    const q = search.toLowerCase()
    if (!q) return stocks.data
    return stocks.data.filter(s =>
      s.Product?.name?.toLowerCase().includes(q) ||
      s.Product?.sku?.toLowerCase().includes(q) ||
      s.Product?.ProductSKUs?.some(sk => sk.sku_code?.toLowerCase().includes(q))
    )
  }, [stocks?.data, search])

  // Initialize localItems from existing DB items once when fill page loads
  useEffect(() => {
    if (session?.status !== 'open' || fillInitialized) return
    if (!existingItems?.data) return
    setLocalItems(existingItems.data.map(item => {
      const sku = item.ProductSKU
      const variantLabel = sku?.ProductVariantOptions?.length
        ? sku.ProductVariantOptions.map(o => o.value).join(' / ')
        : ''
      return {
        id:           item.id,
        productId:    String(item.ProductId),
        skuId:        item.ProductSKUId ? String(item.ProductSKUId) : null,
        skuKey:       item.ProductSKUId ? `sku-${item.ProductSKUId}` : `prod-${item.ProductId}`,
        productName:  item.Product?.name ?? `#${item.ProductId}`,
        skuCode:      sku?.sku_code ?? item.Product?.sku ?? '',
        variantLabel,
        systemQty:    item.system_qty,
        qty:          item.scanned_qty,
        saved:        true,
        dirty:        false,
      }
    }))
    setFillInitialized(true)
    setFillMode(canManual ? 'manual' : 'scan')
  }, [session?.status, fillInitialized, existingItems?.data, canManual])

  // ── Mutations ─────────────────────────────────────────────────────────────────
  const cancelSession = useMutation({
    mutationFn: () => opnameSessionsApi.update(id, { status: 'cancelled' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['opname'] })
      toast.success('Session dibatalkan')
      navigate('/opname')
    },
    onError: e => toast.error(e.response?.data?.message || 'Error'),
  })

  const closeSession = useMutation({
    mutationFn: () => opnameSessionsApi.update(id, { status: 'closed' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['opname'] })
      qc.invalidateQueries({ queryKey: ['opname-session', id] })
      qc.invalidateQueries({ queryKey: ['stocks'] })
      qc.invalidateQueries({ queryKey: ['movements'] })
      toast.success('Session ditutup — stok disesuaikan')
      setScannerConnected(false)
      setConfirmMode(null)
    },
    onError: e => toast.error(e.response?.data?.message || 'Error'),
  })

  const submitOpname = useMutation({
    mutationFn: async (items) => {
      for (const item of items) {
        if (!item.saved) {
          await opnameItemsApi.create({
            StockOpnameSessionId: id,
            ProductId:            item.productId,
            ProductSKUId:         item.skuId || undefined,
            actualQty:            Number(item.qty),
          })
        } else if (item.dirty) {
          await opnameItemsApi.update(item.id, {
            scanned_qty: Number(item.qty),
            difference:  Number(item.qty) - Number(item.systemQty),
          })
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['opname-items', id] })
      toast.success('Hasil opname disimpan')
      setLocalItems([])
      setFillInitialized(false)
      setScannerConnected(false)
      setConfirmMode(null)
    },
    onError: e => toast.error(e.response?.data?.message || 'Error'),
  })

  // ── Fill helpers ──────────────────────────────────────────────────────────────
  const addProduct = (stock) => {
    const productId = String(stock.ProductId)
    const skuKey = `prod-${productId}`
    if (localItems.find(i => i.skuKey === skuKey)) {
      toast.error('Produk sudah ada di daftar hitung')
      return
    }
    setLocalItems(prev => [...prev, {
      id: null, saved: false, dirty: false,
      productId,
      skuId:        null,
      skuKey,
      productName:  stock.Product?.name ?? `#${productId}`,
      skuCode:      stock.Product?.sku ?? '',
      variantLabel: '',
      systemQty:    stock.quantity,
      qty:          '',
    }])
    setSearch('')
  }

  const handleScan = async (code) => {
    try {
      const sku       = await stockInApi.resolveSku(code)
      const productId = String(sku.ProductId ?? sku.Product?.id)
      const skuId     = String(sku.id)
      const skuKey    = `sku-${skuId}`
      const systemQty = stocks?.data?.find(s => String(s.ProductId) === productId)?.quantity ?? 0
      const label     = skuLabel(sku)
      setLocalItems(prev => {
        const idx = prev.findIndex(i => i.skuKey === skuKey)
        if (idx >= 0) {
          const next = [...prev]
          next[idx] = { ...next[idx], qty: (Number(next[idx].qty) || 0) + 1, dirty: true }
          return next
        }
        return [...prev, {
          id: null, saved: false, dirty: false,
          productId,
          skuId,
          skuKey,
          productName:  sku.Product?.name ?? code,
          skuCode:      sku.sku_code ?? code,
          variantLabel: label,
          systemQty,
          qty: 1,
        }]
      })
      toast.success(`${sku.Product?.name ?? code}${label ? ` · ${label}` : ''} +1`)
    } catch {
      toast.error(`SKU "${code}" tidak ditemukan`)
    }
  }

  useExternalScanner(handleScan, session?.status === 'open' && scannerConnected)

  const updateQty = (skuKey, val) =>
    setLocalItems(prev => prev.map(i =>
      i.skuKey === skuKey ? { ...i, qty: val, dirty: true } : i
    ))

  const removeItem = async (item) => {
    if (item.saved && item.id) {
      setLocalItems(prev => prev.filter(i => i.skuKey !== item.skuKey))
      try {
        await opnameItemsApi.remove(item.id)
        qc.invalidateQueries({ queryKey: ['opname-items', id] })
      } catch {
        toast.error('Gagal menghapus item')
        setLocalItems(prev => [...prev, item])
      }
    } else {
      setLocalItems(prev => prev.filter(i => i.skuKey !== item.skuKey))
    }
  }

  const handleSubmitClick = () => {
    const toSubmit = localItems.filter(i => !i.saved || i.dirty)
    if (!toSubmit.length) return toast.error('Tidak ada perubahan untuk disimpan')
    const invalid = toSubmit.find(i => i.qty === '' || i.qty == null)
    if (invalid) return toast.error(`Masukkan qty untuk: ${invalid.productName}`)
    setConfirmMode('submit')
  }

  const itemsToSubmit = localItems.filter(i => !i.saved || i.dirty)

  if (sessionLoading) return <div className="p-8 text-slate-400 text-sm">Memuat…</div>
  if (!session)       return <div className="p-8 text-red-500 text-sm">Session tidak ditemukan.</div>

  // ── VIEW MODE (closed / cancelled) ────────────────────────────────────────────
  if (session.status !== 'open') {
    const items = existingItems?.data ?? []
    return (
      <div className="px-6 py-6 max-w-4xl">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate('/opname')} className="p-1.5 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
            <ArrowLeft size={16} />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-slate-800">Hasil Opname — Sesi #{session.id}</h1>
            <p className="text-xs text-slate-400">
              {session.Warehouse?.name} · Ditutup: {session.finished_at ? new Date(session.finished_at).toLocaleDateString('id-ID') : '—'}
            </p>
          </div>
          {items.length > 0 && (
            <button
              onClick={() => {
                const headers = ['No', 'Produk', 'SKU', 'Stok Sistem', 'Stok Aktual', 'Selisih']
                const rows = items.map((item, i) => [
                  i + 1, item.Product?.name ?? '—', item.Product?.sku ?? '—',
                  item.system_qty, item.scanned_qty, item.difference ?? 0,
                ])
                exportExcel(`opname-sesi-${id}-${new Date().toISOString().slice(0, 10)}`, { headers, rows, sheetName: 'Hasil Opname' })
              }}
              className="btn-secondary text-sm flex items-center gap-1.5"
            >
              <FileSpreadsheet size={14} /> Export Excel
            </button>
          )}
        </div>

        <div className="card p-5 mb-5 grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
          <div><p className="label mb-1">Warehouse</p><p className="font-semibold text-slate-700">{session.Warehouse?.name ?? '—'}</p></div>
          <div><p className="label mb-1">Dimulai</p><p className="font-mono text-slate-600">{new Date(session.started_at).toLocaleDateString('id-ID')}</p></div>
          <div className="col-span-2 sm:col-span-1">
            <p className="label mb-1">Status</p>
            <p className={`font-semibold ${session.status === 'closed' ? 'text-success' : 'text-slate-400'}`}>
              {session.status === 'closed' ? '✓ Closed' : '✕ Cancelled'}
            </p>
          </div>
        </div>

        {items.length > 0 ? (
          <div className="card">
            <div className="px-5 py-3 bg-slate-50 border-b border-slate-200">
              <span className="text-xs font-bold text-slate-600 uppercase tracking-wide">Hasil Hitung Opname ({items.length})</span>
            </div>
            <div className="overflow-x-auto">
            <table className="w-full min-w-[400px] text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="th py-2 text-left">Produk</th>
                  <th className="th py-2 text-right w-24">Sistem</th>
                  <th className="th py-2 text-right w-24">Aktual</th>
                  <th className="th py-2 text-right w-24">Selisih</th>
                </tr>
              </thead>
              <tbody>
                {items.map(item => {
                  const diff = item.difference ?? 0
                  return (
                    <tr key={item.id} className="tr border-b border-slate-50">
                      <td className="td py-2">
                        <p className="font-medium">{item.Product?.name}</p>
                        <p className="text-xs font-mono text-slate-400">{item.Product?.sku}</p>
                      </td>
                      <td className="td py-2 text-right font-mono text-slate-500">{item.system_qty}</td>
                      <td className="td py-2 text-right font-mono">{item.scanned_qty}</td>
                      <td className={`td py-2 text-right font-mono font-bold ${diff > 0 ? 'text-success' : diff < 0 ? 'text-danger' : 'text-slate-400'}`}>
                        {diff > 0 ? '+' : ''}{diff}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            </div>
          </div>
        ) : (
          <div className="card p-10 text-center text-slate-400 text-sm">Tidak ada data opname tersimpan.</div>
        )}
      </div>
    )
  }

  // ── FILL MODE (open sessions) ─────────────────────────────────────────────────
  return (
    <div className="px-6 py-6 max-w-5xl">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/opname')} className="p-1.5 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
          <ArrowLeft size={16} />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-slate-800">Fill Opname — Sesi #{session.id}</h1>
          <p className="text-xs text-slate-400">
            {session.Warehouse?.name} · Dimulai: {new Date(session.started_at).toLocaleDateString('id-ID')}
            {localItems.some(i => i.saved) && (
              <span className="ml-2 text-blue-500 font-medium">· {localItems.filter(i => i.saved).length} item tersimpan</span>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.currentTarget.blur() // lepas fokus agar Enter dari scanner tidak memicu tombol ini
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

      {/* Inline confirm panels */}
      {confirmMode === 'submit' && (
        <div className="card p-5 mb-5 border-blue-200 bg-blue-50/50">
          <p className="text-sm font-semibold text-slate-800 mb-3">Konfirmasi Submit Opname</p>
          <p className="text-sm text-slate-600 mb-3">
            Simpan <span className="font-bold">{itemsToSubmit.length} perubahan</span> untuk Sesi #{session.id}?
          </p>
          <div className="bg-white rounded-lg border border-slate-200 p-3 max-h-40 overflow-y-auto space-y-1.5 mb-3">
            {itemsToSubmit.map(i => (
              <div key={i.skuKey} className="flex items-center justify-between text-xs">
                <span className="text-slate-700 truncate">{i.productName}</span>
                <div className="flex items-center gap-3 ml-2 shrink-0">
                  <span className="text-slate-400">sistem: {i.systemQty}</span>
                  <span className="font-mono font-bold text-slate-800">aktual: {i.qty}</span>
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-400 mb-4">Setelah submit, tutup sesi untuk menyesuaikan stok secara otomatis.</p>
          <div className="flex gap-2">
            <button onClick={() => setConfirmMode(null)} className="btn-secondary flex-1 justify-center">Kembali</button>
            <button onClick={() => submitOpname.mutate(localItems)} disabled={submitOpname.isPending} className="btn-primary flex-1 justify-center">
              {submitOpname.isPending ? 'Menyimpan…' : 'Konfirmasi Submit'}
            </button>
          </div>
        </div>
      )}

      {confirmMode === 'cancel' && (
        <div className="card p-5 mb-5 border-red-200 bg-red-50/50">
          <p className="text-sm font-semibold text-slate-800 mb-2">Batalkan Sesi Opname?</p>
          <p className="text-sm text-slate-600 mb-2">Sesi akan ditandai sebagai <span className="font-semibold text-danger">Cancelled</span> dan tidak bisa dilanjutkan.</p>
          <p className="text-xs text-warning font-semibold mb-4">Data hitung yang belum disubmit akan hilang.</p>
          <div className="flex gap-2">
            <button onClick={() => setConfirmMode(null)} className="btn-secondary flex-1 justify-center">Kembali</button>
            <button onClick={() => cancelSession.mutate()} disabled={cancelSession.isPending} className="btn-danger flex-1 justify-center">
              {cancelSession.isPending ? 'Membatalkan…' : 'Ya, Batalkan Sesi'}
            </button>
          </div>
        </div>
      )}

      {confirmMode === 'close' && (
        <div className="card p-5 mb-5 border-green-200 bg-green-50/50">
          <p className="text-sm font-semibold text-slate-800 mb-2">Tutup Sesi Opname</p>
          <p className="text-sm text-slate-600 mb-2">Sesi akan ditutup dan stok disesuaikan berdasarkan data hasil hitung opname.</p>
          <p className="text-xs text-warning font-semibold mb-4">Tindakan ini tidak dapat dibatalkan.</p>
          <div className="flex gap-2">
            <button onClick={() => setConfirmMode(null)} className="btn-secondary flex-1 justify-center">Batal</button>
            <button onClick={() => closeSession.mutate()} disabled={closeSession.isPending} className="btn-primary flex-1 justify-center">
              {closeSession.isPending ? 'Menutup…' : 'Tutup & Sesuaikan Stok'}
            </button>
          </div>
        </div>
      )}

      {/* Mode toggle */}
      {canManual && canScan && (
        <div className="flex gap-2 p-1 bg-slate-100 rounded-xl mb-5">
          <button onClick={() => setFillMode('manual')} className={`flex-1 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-all ${fillMode === 'manual' ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>
            <ClipboardList size={14} /> Input Manual
          </button>
          <button onClick={() => setFillMode('scan')} className={`flex-1 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-all ${fillMode === 'scan' ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>
            <ScanLine size={14} /> Scan Barcode
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
        {/* LEFT: Search + product list */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input className="input pl-8 text-sm" placeholder="Cari produk…" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            {(fillMode === 'scan' || (!canManual && canScan)) && (
              <button onClick={() => setShowScanner(true)} className="btn-primary px-3 py-2 flex items-center gap-1.5 text-sm whitespace-nowrap">
                <ScanLine size={14} /> Scan
              </button>
            )}
          </div>

          <div className="card overflow-hidden">
            <div className="px-3 py-2 bg-slate-50 border-b border-slate-200">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                {stocksLoading ? 'Memuat…' : `${filteredStocks.length} produk di gudang ini`}
              </span>
            </div>
            <div className="max-h-72 overflow-y-auto divide-y divide-slate-50">
              {!stocksLoading && filteredStocks.length === 0 && (
                <p className="text-xs text-slate-400 text-center py-6">Tidak ada produk</p>
              )}
              {filteredStocks.map(s => {
                const productId = String(s.ProductId)
                const already   = localItems.some(i => i.skuKey === `prod-${productId}`)
                const clickable = fillMode === 'manual' && !already
                return (
                  <button
                    key={productId}
                    onClick={() => clickable && addProduct(s)}
                    disabled={!clickable}
                    className={`w-full text-left px-3 py-2.5 flex items-center justify-between transition-colors
                      ${already   ? 'bg-success-light/60 cursor-default' : ''}
                      ${clickable ? 'hover:bg-slate-50 cursor-pointer'   : 'cursor-default'}
                    `}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{s.Product?.name}</p>
                      <p className="text-xs font-mono text-slate-400">{s.Product?.sku}</p>
                    </div>
                    <div className="text-right ml-2 shrink-0">
                      <p className="text-xs text-slate-400">sistem</p>
                      <p className="text-sm font-mono font-bold text-slate-600">{s.quantity}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
          <p className="text-xs text-slate-400">
            {fillMode === 'manual' ? 'Klik produk untuk menambahkan ke daftar hitung.' : 'Daftar untuk referensi. Gunakan tombol Scan untuk menghitung.'}
          </p>
        </div>

        {/* RIGHT: Counted items */}
        <div>
          <div className="card overflow-hidden">
            <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Hasil Hitung</span>
              <span className="text-xs text-slate-400">{localItems.length} produk</span>
            </div>
            <div className="max-h-[340px] overflow-y-auto divide-y divide-slate-50">
              {localItems.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-12">
                  {fillMode === 'scan' ? 'Scan barcode untuk mulai menghitung' : 'Pilih produk dari kiri'}
                </p>
              ) : localItems.map(item => (
                <div key={item.skuKey} className={`px-3 py-2.5 flex items-center gap-2 ${item.dirty ? 'bg-amber-50/60' : ''}`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-medium text-slate-800 truncate">{item.productName}</p>
                      {item.saved && !item.dirty && <span className="text-[10px] badge-green px-1 py-0 shrink-0">tersimpan</span>}
                      {item.dirty && <span className="text-[10px] badge-amber px-1 py-0 shrink-0">diubah</span>}
                    </div>
                    {item.variantLabel ? <p className="text-xs text-slate-500 truncate">{item.variantLabel}</p> : null}
                    <p className="text-[10px] font-mono text-slate-400 truncate">{item.skuCode}</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <div className="text-right mr-1">
                      <p className="text-[10px] text-slate-400">sistem</p>
                      <p className="text-xs font-mono text-slate-500">{item.systemQty}</p>
                    </div>
                    <input
                      type="number" min="0"
                      className="input w-16 text-center py-1 text-sm font-mono font-bold"
                      value={item.qty}
                      onChange={e => updateQty(item.skuKey, e.target.value)}
                      readOnly={fillMode === 'scan' && !canManual}
                    />
                    <button
                      onClick={() => removeItem(item)}
                      className="p-1 rounded text-slate-400 hover:text-danger hover:bg-danger-light transition-colors"
                    >
                      <X size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Footer actions */}
      <div className="flex flex-wrap items-center gap-2 pt-4 border-t border-slate-100">
        <button onClick={() => setConfirmMode('cancel')} className="btn-danger text-sm px-3">Batalkan Sesi</button>
        <div className="flex-1" />
        <button onClick={() => navigate('/opname')} className="btn-secondary text-sm">Tutup</button>
        <button
          onClick={() => setConfirmMode('close')}
          className="text-sm px-3 py-2 rounded-lg font-medium flex items-center gap-1.5 bg-success-light text-success border border-success/20 hover:bg-success hover:text-white transition-colors"
        >
          <CheckCircle size={14} /> Close
        </button>
        <button onClick={handleSubmitClick} className="btn-primary text-sm">
          Submit ({itemsToSubmit.length})
        </button>
      </div>

      {showScanner && (
        <QRScanner onScan={handleScan} onClose={() => setShowScanner(false)} autoClose={false} hint="Scan semua produk lalu tutup untuk menyimpan" />
      )}
    </div>
  )
}
