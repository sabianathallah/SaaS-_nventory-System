import { useState, useEffect, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { opnameSessionsApi, opnameItemsApi, warehousesApi, stocksApi, stockInApi } from '../api'
import { useAuth } from '../context/AuthContext'
import PageHeader from '../components/PageHeader'
import { Table, Pagination } from '../components/Table'
import Modal from '../components/Modal'
import QRScanner from '../components/QRScanner'
import { useExternalScanner } from '../hooks/useExternalScanner'
import toast from 'react-hot-toast'
import { exportExcel } from '../utils/exportExcel'
import { Plus, Eye, CheckCircle, Search, X, ScanLine, ClipboardList, FileSpreadsheet, ScanBarcode } from 'lucide-react'

const STATUS_BADGE = {
  open:      <span className="badge-amber">● Open</span>,
  closed:    <span className="badge-green">✓ Closed</span>,
  cancelled: <span className="badge-muted">✕ Cancelled</span>,
}

// localItems shape:
// { id, productId, productName, sku, systemQty, qty, saved, dirty }
// saved = already in DB (has id), dirty = modified after load

export default function Opname() {
  const qc = useQueryClient()
  const { hasPermission } = useAuth()

  const canManual = hasPermission('stock.opname.manual_input')
  const canScan   = hasPermission('stock.opname.scan')

  // List filters
  const [page, setPage]                   = useState(1)
  const [statusFilter, setStatusFilter]   = useState('')
  const [whFilter, setWhFilter]           = useState('')
  const [showCancelled, setShowCancelled] = useState(false)

  // Modal
  const [modal, setModal] = useState(null)

  // Create form
  const [form, setForm] = useState({ warehouseId: '', notes: '' })

  // Fill state
  const [localItems, setLocalItems]       = useState([])
  const [fillMode, setFillMode]           = useState('manual')
  const [search, setSearch]               = useState('')
  const [showScanner, setShowScanner]         = useState(false)
  const [scannerConnected, setScannerConnected] = useState(false)
  const [fillInitialized, setFillInitialized]   = useState(false)

  const activeWarehouseId = modal?.data?.warehouseId
  const activeSessionId   = modal?.data?.id

  // ── Queries ────────────────────────────────────────────────────────────────
  const { data, isLoading } = useQuery({
    queryKey: ['opname', { page, status: statusFilter || undefined, warehouseId: whFilter || undefined }],
    queryFn:  () => opnameSessionsApi.list({ page, limit: 10, status: statusFilter || undefined, warehouseId: whFilter || undefined }),
  })
  const { data: warehouses } = useQuery({
    queryKey: ['warehouses', { limit: 100 }],
    queryFn:  () => warehousesApi.list({ limit: 100 }),
  })
  const { data: stocks, isLoading: stocksLoading } = useQuery({
    queryKey: ['stocks-opname', { WarehouseId: activeWarehouseId }],
    queryFn:  () => stocksApi.list({ WarehouseId: activeWarehouseId, limit: 500 }),
    enabled:  !!activeWarehouseId && modal?.mode === 'fill',
  })
  // Load existing items for both fill (to restore) and view (to display result)
  const { data: existingItems } = useQuery({
    queryKey: ['opname-items', activeSessionId],
    queryFn:  () => opnameItemsApi.list({ SessionId: activeSessionId, limit: 500 }),
    enabled:  !!activeSessionId && (modal?.mode === 'fill' || modal?.mode === 'view'),
  })

  // Filtered product list for search
  const filteredStocks = useMemo(() => {
    if (!stocks?.data) return []
    const q = search.toLowerCase()
    if (!q) return stocks.data
    return stocks.data.filter(s =>
      s.Product?.name?.toLowerCase().includes(q) ||
      s.Product?.sku?.toLowerCase().includes(q)
    )
  }, [stocks?.data, search])

  // Summary counts (current page)
  const openCount      = data?.data?.filter(s => s.status === 'open').length      ?? 0
  const closedCount    = data?.data?.filter(s => s.status === 'closed').length    ?? 0
  const cancelledCount = data?.data?.filter(s => s.status === 'cancelled').length ?? 0

  // Initialize localItems from existing items ONCE when fill modal opens
  useEffect(() => {
    if (modal?.mode !== 'fill' || fillInitialized) return
    if (!existingItems?.data) return
    setLocalItems(existingItems.data.map(item => ({
      id:          item.id,
      productId:   String(item.ProductId),
      productName: item.Product?.name ?? `#${item.ProductId}`,
      sku:         item.Product?.sku  ?? '',
      systemQty:   item.system_qty,
      qty:         item.scanned_qty,
      saved:       true,
      dirty:       false,
    })))
    setFillInitialized(true)
  }, [modal?.mode, fillInitialized, existingItems?.data])

  // ── Mutations ──────────────────────────────────────────────────────────────
  const create = useMutation({
    mutationFn: d => opnameSessionsApi.create(d),
    onSuccess: () => { qc.invalidateQueries(['opname']); toast.success('Session dibuat'); setModal(null) },
    onError: e => toast.error(e.response?.data?.message || 'Error'),
  })

  const cancelSession = useMutation({
    mutationFn: id => opnameSessionsApi.update(id, { status: 'cancelled' }),
    onSuccess: () => { qc.invalidateQueries(['opname']); toast.success('Session dibatalkan'); setModal(null) },
    onError: e => toast.error(e.response?.data?.message || 'Error'),
  })

  const closeSession = useMutation({
    mutationFn: id => opnameSessionsApi.update(id, { status: 'closed' }),
    onSuccess: () => {
      qc.invalidateQueries(['opname'])
      qc.invalidateQueries(['stocks'])
      qc.invalidateQueries(['movements'])
      toast.success('Session ditutup — stok disesuaikan')
      setScannerConnected(false)
      setModal(null)
    },
    onError: e => toast.error(e.response?.data?.message || 'Error'),
  })

  // Submit: POST new items + PUT dirty saved items
  const submitOpname = useMutation({
    mutationFn: async ({ sessionId, items }) => {
      for (const item of items) {
        if (!item.saved) {
          await opnameItemsApi.create({
            StockOpnameSessionId: sessionId,
            ProductId: item.productId,
            actualQty: Number(item.qty),
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
      qc.invalidateQueries(['opname-items', activeSessionId])
      toast.success('Hasil opname disimpan')
      setLocalItems([])
      setFillInitialized(false)
      setScannerConnected(false)
      setModal(null)
    },
    onError: e => toast.error(e.response?.data?.message || 'Error'),
  })

  // ── Fill helpers ───────────────────────────────────────────────────────────
  const openFill = (session) => {
    setLocalItems([])
    setFillInitialized(false)
    setSearch('')
    setScannerConnected(false)
    setFillMode(canManual ? 'manual' : 'scan')
    setModal({ mode: 'fill', data: session })
  }

  const addProduct = (stock) => {
    const productId = String(stock.ProductId)
    if (localItems.find(i => i.productId === productId)) {
      toast.error('Produk sudah ada di daftar hitung')
      return
    }
    setLocalItems(prev => [...prev, {
      id: null, saved: false, dirty: false,
      productId,
      productName: stock.Product?.name ?? `#${productId}`,
      sku:        stock.Product?.sku ?? '',
      systemQty:  stock.quantity,
      qty:        '',
    }])
    setSearch('')
  }

  const handleScan = async (code) => {
    setShowScanner(false)
    try {
      const sku       = await stockInApi.resolveSku(code)
      const productId = String(sku.ProductId ?? sku.Product?.id)
      const systemQty = stocks?.data?.find(s => String(s.ProductId) === productId)?.quantity ?? 0

      setLocalItems(prev => {
        const idx = prev.findIndex(i => i.productId === productId)
        if (idx >= 0) {
          const next = [...prev]
          next[idx] = { ...next[idx], qty: (Number(next[idx].qty) || 0) + 1, dirty: true }
          return next
        }
        return [...prev, {
          id: null, saved: false, dirty: false,
          productId,
          productName: sku.Product?.name ?? code,
          sku:        sku.sku_code ?? code,
          systemQty,
          qty:        1,
        }]
      })
      toast.success(`${sku.Product?.name ?? code} +1`)
    } catch {
      toast.error(`SKU "${code}" tidak ditemukan`)
    }
  }

  useExternalScanner(handleScan, modal?.mode === 'fill' && scannerConnected)

  const updateQty = (productId, val) =>
    setLocalItems(prev => prev.map(i =>
      i.productId === productId ? { ...i, qty: val, dirty: true } : i
    ))

  // Cancel per SKU: delete from DB if saved, then remove from local state
  const removeItem = async (item) => {
    if (item.saved && item.id) {
      setLocalItems(prev => prev.filter(i => i.productId !== item.productId)) // optimistic
      try {
        await opnameItemsApi.remove(item.id)
        qc.invalidateQueries(['opname-items', activeSessionId])
      } catch {
        toast.error('Gagal menghapus item')
        setLocalItems(prev => [...prev, item]) // rollback
      }
    } else {
      setLocalItems(prev => prev.filter(i => i.productId !== item.productId))
    }
  }

  const handleSubmitClick = () => {
    const toSubmit = localItems.filter(i => !i.saved || i.dirty)
    if (!toSubmit.length) return toast.error('Tidak ada perubahan untuk disimpan')
    const invalid = toSubmit.find(i => i.qty === '' || i.qty == null)
    if (invalid) return toast.error(`Masukkan qty untuk: ${invalid.productName}`)
    setModal(prev => ({ ...prev, mode: 'submit-confirm' }))
  }

  // ── Table ──────────────────────────────────────────────────────────────────
  const visibleData = showCancelled
    ? data?.data
    : data?.data?.filter(s => s.status !== 'cancelled')

  const columns = [
    { key: 'id',        label: '#',        width: 60,  render: r => <span className="font-mono text-xs text-slate-400">{r.id}</span> },
    { key: 'warehouse', label: 'Warehouse',            render: r => <span className="font-semibold text-slate-800">{r.Warehouse?.name ?? '—'}</span> },
    { key: 'status',    label: 'Status',    width: 110, render: r => STATUS_BADGE[r.status] ?? <span className="badge-muted">{r.status}</span> },
    { key: 'started',   label: 'Started',   width: 100, render: r => <span className="text-xs text-slate-400">{new Date(r.started_at).toLocaleDateString()}</span> },
    { key: 'finished',  label: 'Finished',  width: 100, render: r => <span className="text-xs text-slate-400">{r.finished_at ? new Date(r.finished_at).toLocaleDateString() : '—'}</span> },
    { key: 'notes',     label: 'Notes',                render: r => <span className="text-xs text-slate-400">{r.notes || '—'}</span> },
    { key: 'actions',   label: '', width: 240, render: r => (
      <div className="flex gap-2">
        {r.status === 'open' && (
          <button onClick={() => openFill(r)} className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5">
            <ClipboardList size={12} /> Fill Opname
          </button>
        )}
        {r.status === 'closed' && (
          <button onClick={() => setModal({ mode: 'view', data: r })} className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5">
            <Eye size={12} /> View Result
          </button>
        )}
        {r.status === 'open' && (
          <button
            onClick={() => setModal({ mode: 'close-confirm', data: r })}
            className="text-xs px-3 py-1.5 rounded font-medium flex items-center gap-1.5 bg-success-light text-success border border-success/20 hover:bg-success hover:text-white transition-colors"
          >
            <CheckCircle size={12} /> Close Session
          </button>
        )}
      </div>
    )},
  ]

  // Items to submit (new or modified)
  const itemsToSubmit = localItems.filter(i => !i.saved || i.dirty)

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="px-6 py-6 space-y-5">
      <PageHeader
        title="Stock Opname"
        subtitle={`${data?.pagination?.total ?? 0} sessions`}
        action={
          <button onClick={() => { setForm({ warehouseId: '', notes: '' }); setModal({ mode: 'create' }) }} className="btn-primary">
            <Plus size={14} /> New Session
          </button>
        }
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="card p-4"><p className="text-xs text-slate-500 mb-1">Total Sessions</p><p className="text-2xl font-bold font-mono text-slate-800">{data?.pagination?.total ?? 0}</p></div>
        <div className="card p-4"><p className="text-xs text-slate-500 mb-1">Open</p><p className="text-2xl font-bold font-mono text-warning">{openCount}</p></div>
        <div className="card p-4"><p className="text-xs text-slate-500 mb-1">Closed</p><p className="text-2xl font-bold font-mono text-success">{closedCount}</p></div>
        <div className="card p-4"><p className="text-xs text-slate-500 mb-1">Cancelled</p><p className="text-2xl font-bold font-mono text-slate-400">{cancelledCount}</p></div>
      </div>

      {/* Filters + Table */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50 flex flex-wrap items-center gap-3">
          <select className="select w-36 text-sm" value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1) }}>
            <option value="">All status</option>
            <option value="open">Open</option>
            <option value="closed">Closed</option>
            {showCancelled && <option value="cancelled">Cancelled</option>}
          </select>
          <select className="select w-44 text-sm" value={whFilter} onChange={e => { setWhFilter(e.target.value); setPage(1) }}>
            <option value="">All warehouses</option>
            {warehouses?.data?.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
          <label className="flex items-center gap-2 text-xs text-slate-500 ml-auto cursor-pointer select-none">
            <input type="checkbox" className="rounded" checked={showCancelled} onChange={e => setShowCancelled(e.target.checked)} />
            Tampilkan Cancelled
          </label>
        </div>
        <Table columns={columns} data={visibleData} loading={isLoading} emptyText="Belum ada sesi opname" />
        <Pagination pagination={data?.pagination} onPageChange={setPage} />
      </div>

      {/* ── CREATE ─────────────────────────────────────────────────────────── */}
      <Modal open={modal?.mode === 'create'} onClose={() => setModal(null)} title="Buat Sesi Opname Baru">
        <form onSubmit={e => { e.preventDefault(); create.mutate({ WarehouseId: form.warehouseId, notes: form.notes }) }} className="space-y-4">
          <div>
            <label className="label">Gudang <span className="text-danger">*</span></label>
            <select className="select" value={form.warehouseId} onChange={e => setForm(f => ({ ...f, warehouseId: e.target.value }))} required>
              <option value="">Pilih gudang…</option>
              {warehouses?.data?.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Catatan</label>
            <input className="input" placeholder="Opsional…" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={() => setModal(null)} className="btn-secondary flex-1 justify-center">Batal</button>
            <button type="submit" disabled={create.isPending} className="btn-primary flex-1 justify-center">{create.isPending ? 'Membuat…' : 'Buat Sesi'}</button>
          </div>
        </form>
      </Modal>

      {/* ── FILL ───────────────────────────────────────────────────────────── */}
      <Modal open={modal?.mode === 'fill'} onClose={() => { setScannerConnected(false); setModal(null) }} title={`Fill Opname — Sesi #${modal?.data?.id}`} size="xl">
        {modal?.data && (
          <div className="space-y-4">
            {/* Session info */}
            <div className="flex items-center gap-3 pb-3 border-b border-slate-100 text-sm">
              <span className="font-semibold text-slate-700">{modal.data.Warehouse?.name}</span>
              <span className="badge-amber text-xs">● Open</span>
              {localItems.some(i => i.saved) && (
                <span className="text-xs text-info font-medium">· {localItems.filter(i => i.saved).length} item tersimpan sebelumnya</span>
              )}
              <span className="text-xs text-slate-400 ml-auto">Dimulai: {new Date(modal.data.started_at).toLocaleDateString()}</span>
            </div>

            {/* Mode toggle */}
            {canManual && canScan && (
              <div className="flex gap-2 p-1 bg-slate-100 rounded-xl">
                <button onClick={() => setFillMode('manual')} className={`flex-1 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-all ${fillMode === 'manual' ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>
                  <ClipboardList size={14} /> Input Manual
                </button>
                <button onClick={() => setFillMode('scan')} className={`flex-1 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-all ${fillMode === 'scan' ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>
                  <ScanLine size={14} /> Scan Barcode
                </button>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              {/* LEFT: Search + product list */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input className="input pl-8 text-sm" placeholder="Cari produk…" value={search} onChange={e => setSearch(e.target.value)} />
                  </div>
                  {(fillMode === 'scan' || (!canManual && canScan)) && (
                    <>
                      <button
                        onClick={() => {
                          setScannerConnected(v => !v)
                          if (!scannerConnected) toast.success('Scanner eksternal terhubung', { icon: '🔌' })
                          else toast('Scanner diputus', { icon: '🔌' })
                        }}
                        className={`flex items-center gap-1.5 px-2.5 py-2 rounded-lg border text-xs font-medium transition-colors whitespace-nowrap ${
                          scannerConnected
                            ? 'bg-green-50 border-green-300 text-green-700 hover:bg-green-100'
                            : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-700'
                        }`}
                      >
                        {scannerConnected
                          ? <><span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> Connected</>
                          : <><ScanBarcode size={13} /> Hubungkan</>
                        }
                      </button>
                      <button onClick={() => setShowScanner(true)} className="btn-primary px-3 py-2 flex items-center gap-1.5 text-sm whitespace-nowrap">
                        <ScanLine size={14} /> Scan
                      </button>
                    </>
                  )}
                </div>

                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <div className="px-3 py-2 bg-slate-50 border-b border-slate-200">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                      {stocksLoading ? 'Memuat…' : `${filteredStocks.length} produk di gudang ini`}
                    </span>
                  </div>
                  <div className="max-h-56 overflow-y-auto divide-y divide-slate-50">
                    {!stocksLoading && filteredStocks.length === 0 && (
                      <p className="text-xs text-slate-400 text-center py-6">Tidak ada produk</p>
                    )}
                    {filteredStocks.map(s => {
                      const productId = String(s.ProductId)
                      const already   = localItems.some(i => i.productId === productId)
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
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Hasil Hitung</span>
                    <span className="text-xs text-slate-400">{localItems.length} produk</span>
                  </div>
                  <div className="max-h-[280px] overflow-y-auto divide-y divide-slate-50">
                    {localItems.length === 0 ? (
                      <p className="text-xs text-slate-400 text-center py-8">
                        {fillMode === 'scan' ? 'Scan barcode untuk mulai menghitung' : 'Pilih produk dari kiri'}
                      </p>
                    ) : localItems.map(item => (
                      <div key={item.productId} className={`px-3 py-2.5 flex items-center gap-2 ${item.dirty ? 'bg-amber-50/60' : ''}`}>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-sm font-medium text-slate-800 truncate">{item.productName}</p>
                            {item.saved && !item.dirty && <span className="text-[10px] badge-green px-1 py-0 shrink-0">tersimpan</span>}
                            {item.dirty && <span className="text-[10px] badge-amber px-1 py-0 shrink-0">diubah</span>}
                          </div>
                          <p className="text-xs font-mono text-slate-400">{item.sku}</p>
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
                            onChange={e => updateQty(item.productId, e.target.value)}
                            readOnly={fillMode === 'scan' && !canManual}
                          />
                          <button
                            onClick={() => removeItem(item)}
                            className="p-1 rounded text-slate-400 hover:text-danger hover:bg-danger-light transition-colors"
                            title="Hapus dari daftar"
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

            {/* Footer */}
            <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
              <button onClick={() => setModal(prev => ({ ...prev, mode: 'cancel-session-confirm' }))} className="btn-danger text-sm px-4">
                Batalkan Sesi
              </button>
              <div className="flex-1" />
              <button onClick={() => setModal(null)} className="btn-secondary text-sm">Tutup</button>
              <button onClick={handleSubmitClick} className="btn-primary text-sm">
                Submit ({itemsToSubmit.length})
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── VIEW RESULT ────────────────────────────────────────────────────── */}
      <Modal open={modal?.mode === 'view'} onClose={() => setModal(null)} title={`Hasil Opname — Sesi #${modal?.data?.id}`} size="lg">
        {modal?.data && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-100 text-sm">
              <span className="font-semibold text-slate-700">{modal.data.Warehouse?.name}</span>
              <span className="badge-green text-xs">✓ Closed</span>
              {modal.data.finished_at && <span className="text-xs text-slate-400 ml-auto">Ditutup: {new Date(modal.data.finished_at).toLocaleDateString()}</span>}
            </div>
            {(existingItems?.data?.length ?? 0) > 0 ? (
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200">
                  <span className="text-xs font-bold text-slate-600 uppercase tracking-wide">Hasil Hitung Opname</span>
                </div>
                <div className="max-h-80 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="bg-slate-50 border-b border-slate-100">
                      <th className="th py-2">Produk</th>
                      <th className="th py-2 text-right">Sistem</th>
                      <th className="th py-2 text-right">Aktual</th>
                      <th className="th py-2 text-right">Selisih</th>
                    </tr></thead>
                    <tbody>
                      {existingItems.data.map(item => {
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
              <p className="text-sm text-slate-400 text-center py-8">Tidak ada data opname tersimpan.</p>
            )}
            <div className="flex items-center justify-between">
              <button
                onClick={() => {
                  const items = existingItems?.data ?? []
                  const headers = ['No', 'Produk', 'SKU', 'Stok Sistem', 'Stok Aktual', 'Selisih']
                  const rows = items.map((item, i) => [
                    i + 1,
                    item.Product?.name ?? '—',
                    item.Product?.sku ?? '—',
                    item.system_qty,
                    item.scanned_qty,
                    item.difference ?? 0,
                  ])
                  exportExcel(`opname-sesi-${modal?.data?.id}-${new Date().toISOString().slice(0, 10)}`, { headers, rows, sheetName: 'Hasil Opname' })
                }}
                className="btn-secondary text-sm flex items-center gap-1.5"
              >
                <FileSpreadsheet size={14} /> Export Excel
              </button>
              <button onClick={() => setModal(null)} className="btn-secondary">Tutup</button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── SUBMIT CONFIRM ─────────────────────────────────────────────────── */}
      <Modal open={modal?.mode === 'submit-confirm'} onClose={() => setModal(prev => ({ ...prev, mode: 'fill' }))} title="Konfirmasi Submit Opname" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Simpan <span className="font-bold text-slate-800">{itemsToSubmit.length} perubahan</span> untuk Sesi #{modal?.data?.id}?
          </p>
          <div className="bg-slate-50 rounded-lg p-3 max-h-44 overflow-y-auto space-y-1.5">
            {itemsToSubmit.map(i => (
              <div key={i.productId} className="flex items-center justify-between text-xs">
                <span className="text-slate-700 truncate">{i.productName}</span>
                <div className="flex items-center gap-3 ml-2 shrink-0">
                  <span className="text-slate-400">sistem: {i.systemQty}</span>
                  <span className="font-mono font-bold text-slate-800">aktual: {i.qty}</span>
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-400">Setelah submit, tutup sesi untuk menyesuaikan stok secara otomatis.</p>
          <div className="flex gap-2">
            <button onClick={() => setModal(prev => ({ ...prev, mode: 'fill' }))} className="btn-secondary flex-1 justify-center">Kembali</button>
            <button onClick={() => submitOpname.mutate({ sessionId: modal.data.id, items: localItems })} disabled={submitOpname.isPending} className="btn-primary flex-1 justify-center">
              {submitOpname.isPending ? 'Menyimpan…' : 'Konfirmasi Submit'}
            </button>
          </div>
        </div>
      </Modal>

      {/* ── CANCEL SESSION CONFIRM ─────────────────────────────────────────── */}
      <Modal open={modal?.mode === 'cancel-session-confirm'} onClose={() => setModal(prev => ({ ...prev, mode: 'fill' }))} title="Batalkan Sesi Opname?" size="sm">
        <p className="text-sm text-slate-600 mb-2">Sesi akan ditandai sebagai <span className="font-semibold text-danger">Cancelled</span> dan tidak bisa dilanjutkan.</p>
        <p className="text-xs text-warning font-semibold mb-5">Data hitung yang belum disubmit akan hilang.</p>
        <div className="flex gap-2">
          <button onClick={() => setModal(prev => ({ ...prev, mode: 'fill' }))} className="btn-secondary flex-1 justify-center">Kembali</button>
          <button onClick={() => cancelSession.mutate(modal.data.id)} disabled={cancelSession.isPending} className="btn-danger flex-1 justify-center">
            {cancelSession.isPending ? 'Membatalkan…' : 'Ya, Batalkan Sesi'}
          </button>
        </div>
      </Modal>

      {/* ── CLOSE SESSION CONFIRM ──────────────────────────────────────────── */}
      <Modal open={modal?.mode === 'close-confirm'} onClose={() => setModal(null)} title="Tutup Sesi Opname" size="sm">
        <p className="text-sm text-slate-600 mb-2">Sesi akan ditutup dan stok disesuaikan berdasarkan data hasil hitung opname.</p>
        <p className="text-xs text-warning font-semibold mb-5">Tindakan ini tidak dapat dibatalkan.</p>
        <div className="flex gap-2">
          <button onClick={() => setModal(null)} className="btn-secondary flex-1 justify-center">Batal</button>
          <button onClick={() => closeSession.mutate(modal.data.id)} disabled={closeSession.isPending} className="btn-primary flex-1 justify-center">
            {closeSession.isPending ? 'Menutup…' : 'Tutup & Sesuaikan Stok'}
          </button>
        </div>
      </Modal>

      {/* QR Scanner */}
      {showScanner && (
        <QRScanner onScan={handleScan} onClose={() => setShowScanner(false)} hint="Scan barcode produk untuk menghitung stok opname" />
      )}
    </div>
  )
}
