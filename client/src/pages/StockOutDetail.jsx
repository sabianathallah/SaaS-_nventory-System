import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { stockOutApi, warehousesApi, stockInApi } from '../api'
import { useAuth } from '../context/AuthContext'
import QRScanner from '../components/QRScanner'
import { useExternalScanner } from '../hooks/useExternalScanner'
import toast from 'react-hot-toast'
import { ArrowLeft, PackageMinus, ScanLine, Plus, Trash2, Save, ScanBarcode } from 'lucide-react'

const fmt = (n) => Number(n ?? 0).toLocaleString('id-ID')
const EMPTY_FORM = { warehouseId: '', note: '', items: [] }

export default function StockOutDetail() {
  const { id }     = useParams()
  const navigate   = useNavigate()
  const qc         = useQueryClient()
  const { hasPermission } = useAuth()
  const isNew      = !id || id === 'new'

  const canManualOutput = hasPermission('stock.out.manual_input')

  const [form, setForm]             = useState(EMPTY_FORM)
  const [manualItem, setManualItem] = useState({ productId: '', quantity: '' })
  const [showScanner, setShowScanner]           = useState(false)
  const [scannerConnected, setScannerConnected] = useState(false)

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

  const { data: productsForManual } = useQuery({
    queryKey: ['products', { limit: 200 }],
    queryFn:  () => import('../api').then(m => m.productsApi.list({ limit: 200 })),
    enabled:  canManualOutput && isNew,
  })

  const { data: stocks } = useQuery({
    queryKey: ['stocks', { WarehouseId: form.warehouseId, limit: 200 }],
    queryFn:  () => import('../api').then(m => m.stocksApi.list({ WarehouseId: form.warehouseId, limit: 200 })),
    enabled:  !!form.warehouseId && isNew,
  })

  const getAvail = (productId) =>
    stocks?.data?.find(s => String(s.ProductId) === String(productId))?.quantity ?? null

  const createMutation = useMutation({
    mutationFn: d => stockOutApi.create(d),
    onSuccess: (data) => {
      qc.invalidateQueries(['stock-out'])
      qc.invalidateQueries(['stocks'])
      toast.success('Stock OUT berhasil dicatat')
      navigate(`/stock-out/${data.id}`)
    },
    onError: e => toast.error(e.response?.data?.message || 'Error'),
  })

  const addManualItem = () => {
    if (!manualItem.productId || !manualItem.quantity) return toast.error('Pilih produk dan masukkan qty')
    const qty   = Number(manualItem.quantity)
    const avail = getAvail(manualItem.productId)
    if (avail !== null && qty > avail) return toast.error(`Hanya ${avail} unit tersedia di gudang ini`)
    const prod = productsForManual?.data?.find(p => String(p.id) === String(manualItem.productId))
    setForm(f => ({ ...f, items: [...f.items, { productId: manualItem.productId, productName: prod?.name, quantity: qty, available: avail }] }))
    setManualItem({ productId: '', quantity: '' })
  }

  const handleScan = async (code) => {
    setShowScanner(false)
    if (!form.warehouseId) return toast.error('Pilih warehouse terlebih dahulu')
    try {
      const sku       = await stockInApi.resolveSku(code)
      const productId = String(sku.ProductId ?? sku.Product?.id)
      const avail     = getAvail(productId)
      const name      = sku.Product?.name ?? code
      setForm(f => {
        const idx = f.items.findIndex(i => i.productId === productId)
        if (idx >= 0) {
          const next = [...f.items]
          next[idx] = { ...next[idx], quantity: next[idx].quantity + 1 }
          return { ...f, items: next }
        }
        return { ...f, items: [...f.items, { productId, productName: name, quantity: 1, available: avail }] }
      })
      toast.success(`${name} +1`)
    } catch {
      toast.error(`SKU "${code}" tidak ditemukan`)
    }
  }

  useExternalScanner(handleScan, isNew && scannerConnected)

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.items.length) return toast.error('Tambahkan minimal 1 item')
    createMutation.mutate({
      WarehouseId: form.warehouseId,
      note:        form.note,
      items:       form.items.map(i => ({ ProductId: i.productId, quantity: i.quantity })),
    })
  }

  // ── VIEW MODE ─────────────────────────────────────────────────────────────────
  if (!isNew) {
    if (isLoading) return <div className="p-8 text-slate-400 text-sm">Memuat…</div>
    if (!detail)   return <div className="p-8 text-red-500 text-sm">Stock OUT tidak ditemukan.</div>

    const items = detail.Stock_Out_Items ?? detail.items ?? []

    return (
      <div className="px-6 py-6 max-w-4xl">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate('/stock-out')} className="p-1.5 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
            <ArrowLeft size={16} />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-slate-800">Stock OUT #{detail.id}</h1>
            <p className="text-xs text-slate-400">
              {new Date(detail.createdAt).toLocaleDateString('id-ID', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
            </p>
          </div>
        </div>

        <div className="card p-5 mb-5 grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
          <div><p className="label mb-1">Warehouse</p><p className="font-semibold text-slate-700">{detail.Warehouse?.name ?? '—'}</p></div>
          <div><p className="label mb-1">Tanggal</p><p className="font-mono text-slate-600">{new Date(detail.createdAt).toLocaleDateString('id-ID')}</p></div>
          <div className="col-span-2 sm:col-span-1"><p className="label mb-1">Catatan</p><p className="text-slate-500">{detail.note || '—'}</p></div>
        </div>

        {items.length > 0 && (
          <div className="card">
            <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
              <PackageMinus size={13} className="text-danger" />
              <span className="text-xs font-bold text-slate-600 uppercase tracking-wide">Items ({items.length})</span>
            </div>
            <div className="overflow-x-auto">
            <table className="w-full min-w-[300px] text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="th py-2 text-left">Produk</th>
                  <th className="th py-2 text-right w-28">Qty</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => (
                  <tr key={item.id ?? idx} className="tr border-b border-slate-100 hover:bg-slate-50/50">
                    <td className="td py-3">
                      <p className="font-semibold text-slate-800">{item.Product?.name ?? `#${item.ProductId}`}</p>
                      {item.Product?.sku && <p className="text-xs font-mono text-slate-400">{item.Product.sku}</p>}
                    </td>
                    <td className="td py-3 text-right font-mono font-bold text-danger">{fmt(item.quantity)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── CREATE MODE ───────────────────────────────────────────────────────────────
  return (
    <div className="px-6 py-6 max-w-4xl">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/stock-out')} className="p-1.5 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
          <ArrowLeft size={16} />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-slate-800">New Stock OUT</h1>
          {!canManualOutput && (
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Warehouse <span className="text-red-500">*</span></label>
              <select
                className="select"
                value={form.warehouseId}
                onChange={e => setForm(f => ({ ...f, warehouseId: e.target.value, items: [] }))}
                required
              >
                <option value="">Pilih warehouse…</option>
                {warehouses?.data?.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Catatan</label>
              <input className="input" placeholder="Catatan (opsional)…" value={form.note}
                onChange={e => setForm(f => ({ ...f, note: e.target.value }))} />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
            <PackageMinus size={13} className="text-danger flex-shrink-0" />
            <span className="text-xs font-bold text-slate-600 uppercase tracking-wide">Items</span>
            {!form.warehouseId && <span className="text-xs text-slate-400 truncate">— pilih warehouse dulu</span>}
            <button
              type="button"
              onClick={() => setShowScanner(true)}
              disabled={!form.warehouseId}
              className="ml-auto flex-shrink-0 flex items-center gap-1.5 text-xs text-slate-500 hover:text-red-700 px-2.5 py-1.5 rounded hover:bg-red-50 border border-slate-200 hover:border-red-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ScanLine size={13} /> Scan QR
            </button>
          </div>

          {/* Input row */}
          <div className="p-4 border-b border-slate-100">
            {canManualOutput ? (
              <div className="flex flex-col sm:flex-row gap-2">
                <select
                  className="select flex-1"
                  value={manualItem.productId}
                  onChange={e => setManualItem(i => ({ ...i, productId: e.target.value }))}
                  disabled={!form.warehouseId}
                >
                  <option value="">Pilih produk…</option>
                  {productsForManual?.data?.map(p => {
                    const avail = getAvail(p.id)
                    return <option key={p.id} value={p.id}>{p.name}{avail !== null ? ` (${avail} tersedia)` : ''}</option>
                  })}
                </select>
                <div className="flex gap-2">
                  <input
                    className="input flex-1 sm:w-24"
                    type="number" min="1" placeholder="Qty"
                    value={manualItem.quantity}
                    onChange={e => setManualItem(i => ({ ...i, quantity: e.target.value }))}
                    disabled={!form.warehouseId}
                  />
                  <button type="button" onClick={addManualItem} className="btn-primary px-4" disabled={!form.warehouseId}>
                    <Plus size={14} />
                  </button>
                </div>
              </div>
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
          {!form.items.length ? (
            <p className="text-center text-slate-400 text-sm py-10">Belum ada item</p>
          ) : (
            <div className="overflow-x-auto">
            <table className="w-full min-w-[400px] text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="th py-2">Produk</th>
                  <th className="th py-2 text-right w-28">Qty</th>
                  <th className="th py-2 text-right w-24">Tersedia</th>
                  <th className="th py-2 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {form.items.map((it, idx) => (
                  <tr key={idx} className="tr border-b border-slate-50">
                    <td className="td py-2">{it.productName}</td>
                    <td className="td py-1.5 text-right">
                      {canManualOutput ? (
                        <input
                          type="number" min="1" max={it.available ?? undefined}
                          value={it.quantity}
                          onChange={e => {
                            const val = Number(e.target.value)
                            if (!val || val < 1) return
                            setForm(f => {
                              const next = [...f.items]
                              next[idx] = { ...next[idx], quantity: val }
                              return { ...f, items: next }
                            })
                          }}
                          className="w-20 text-right font-mono font-semibold text-danger border border-slate-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:border-brand/50 bg-white"
                        />
                      ) : (
                        <span className="font-mono font-semibold text-danger">{it.quantity}</span>
                      )}
                    </td>
                    <td className="td py-2 text-right font-mono text-slate-400">{it.available ?? '—'}</td>
                    <td className="td py-2">
                      <button type="button"
                        onClick={() => setForm(f => ({ ...f, items: f.items.filter((_, i) => i !== idx) }))}
                        className="p-1 text-slate-300 hover:text-danger transition-colors">
                        <Trash2 size={12} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <button type="button" onClick={() => navigate('/stock-out')} className="btn-secondary flex-1 justify-center">Batal</button>
          <button type="submit" disabled={createMutation.isPending} className="btn-primary flex-1 justify-center">
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
