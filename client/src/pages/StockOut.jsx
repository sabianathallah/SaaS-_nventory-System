import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { stockOutApi, warehousesApi, stockInApi } from '../api'
import { useAuth } from '../context/AuthContext'
import PageHeader from '../components/PageHeader'
import { Table, Pagination } from '../components/Table'
import Modal from '../components/Modal'
import QRScanner from '../components/QRScanner'
import toast from 'react-hot-toast'
import { Plus, Trash2, PackageMinus, Eye, ScanLine, Package, CheckCircle2, X } from 'lucide-react'

const fmt = (n) => Number(n ?? 0).toLocaleString('id-ID')

// ── Scan confirm popup ────────────────────────────────────────────────────────
function ScanConfirm({ sku, available, onConfirm, onCancel }) {
  const [qty, setQty] = useState(1)
  const prod = sku.Product

  const handleConfirm = () => {
    const n = Number(qty)
    if (!n || n <= 0) return toast.error('Qty harus > 0')
    if (available !== null && n > available) return toast.error(`Hanya ${available} unit tersedia`)
    onConfirm({ productId: String(sku.ProductId ?? prod?.id), productName: prod?.name, quantity: n, available })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-5 space-y-4 animate-fade-in">
        <div className="flex items-center gap-3">
          {prod?.imageUrl
            ? <img src={prod.imageUrl} className="w-12 h-12 rounded-xl object-cover border border-slate-200 flex-shrink-0" />
            : <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0"><Package size={18} className="text-slate-300" /></div>
          }
          <div className="min-w-0">
            <p className="font-bold text-slate-800 leading-tight truncate">{prod?.name ?? 'Produk'}</p>
            <p className="text-xs text-slate-400 mt-0.5">{sku.sku_code}</p>
            <p className="text-[10px] font-mono text-emerald-600 mt-0.5 flex items-center gap-1">
              <CheckCircle2 size={10} /> Barcode cocok {available !== null ? `· stok ${available}` : ''}
            </p>
          </div>
        </div>

        <div>
          <label className="label">Jumlah (Qty) <span className="text-red-500">*</span></label>
          <input
            type="number" min="1" max={available ?? undefined}
            className="input text-center font-bold text-lg"
            value={qty} onChange={e => setQty(e.target.value)}
            autoFocus
          />
        </div>

        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onCancel}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors">
            <X size={14} /> Batal
          </button>
          <button type="button" onClick={handleConfirm}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-brand text-white text-sm font-semibold hover:bg-red-700 transition-colors">
            <Plus size={14} /> Tambah Item
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
const EMPTY_FORM = { warehouseId: '', note: '', items: [] }

export default function StockOut() {
  const qc = useQueryClient()
  const { hasPermission } = useAuth()
  const [page, setPage]           = useState(1)
  const [modal, setModal]         = useState(null)
  const [form, setForm]           = useState(EMPTY_FORM)
  const [showScanner, setShowScanner] = useState(false)
  const [scanConfirm, setScanConfirm] = useState(null) // { sku, available }

  const canManualOutput = hasPermission('stock.out.manual_input')

  const { data, isLoading } = useQuery({
    queryKey: ['stock-out', { page }],
    queryFn:  () => stockOutApi.list({ page, limit: 10 }),
  })
  const { data: warehouses } = useQuery({
    queryKey: ['warehouses', { limit: 100 }],
    queryFn:  () => warehousesApi.list({ limit: 100 }),
  })

  const create = useMutation({
    mutationFn: d => stockOutApi.create(d),
    onSuccess: () => {
      qc.invalidateQueries(['stock-out'])
      qc.invalidateQueries(['stocks'])
      toast.success('Stock OUT berhasil dicatat')
      setModal(null); setForm(EMPTY_FORM)
    },
    onError: e => toast.error(e.response?.data?.message || 'Error'),
  })

  // ── Manual add row (admin only) ───────────────────────────────────────────
  const [manualItem, setManualItem] = useState({ productId: '', quantity: '' })
  const { data: productsForManual } = useQuery({
    queryKey: ['products', { limit: 200 }],
    queryFn:  () => import('../api').then(m => m.productsApi.list({ limit: 200 })),
    enabled:  canManualOutput && modal?.mode === 'create',
  })
  const { data: stocks } = useQuery({
    queryKey: ['stocks', { WarehouseId: form.warehouseId, limit: 200 }],
    queryFn:  () => import('../api').then(m => m.stocksApi.list({ WarehouseId: form.warehouseId, limit: 200 })),
    enabled:  !!form.warehouseId && modal?.mode === 'create',
  })

  const getAvail = (productId) =>
    stocks?.data?.find(s => String(s.ProductId) === String(productId))?.quantity ?? null

  const addManualItem = () => {
    if (!manualItem.productId || !manualItem.quantity) return toast.error('Pilih produk dan masukkan qty')
    const qty   = Number(manualItem.quantity)
    const avail = getAvail(manualItem.productId)
    if (avail !== null && qty > avail) return toast.error(`Hanya ${avail} unit tersedia di gudang ini`)
    const prod = productsForManual?.data?.find(p => String(p.id) === String(manualItem.productId))
    setForm(f => ({ ...f, items: [...f.items, { productId: manualItem.productId, productName: prod?.name, quantity: qty, available: avail }] }))
    setManualItem({ productId: '', quantity: '' })
  }

  // ── QR scan handler ───────────────────────────────────────────────────────
  const handleScan = async (code) => {
    setShowScanner(false)
    if (!form.warehouseId) return toast.error('Pilih warehouse terlebih dahulu')
    try {
      const sku = await stockInApi.resolveSku(code)
      const avail = getAvail(sku.ProductId ?? sku.Product?.id)
      setScanConfirm({ sku, available: avail })
    } catch {
      toast.error(`SKU "${code}" tidak ditemukan`)
    }
  }

  const handleScanConfirm = (item) => {
    // Merge quantity if same product scanned again
    setForm(f => {
      const idx = f.items.findIndex(i => i.productId === item.productId)
      if (idx >= 0) {
        const next = [...f.items]
        next[idx] = { ...next[idx], quantity: next[idx].quantity + item.quantity }
        return { ...f, items: next }
      }
      return { ...f, items: [...f.items, item] }
    })
    setScanConfirm(null)
    toast.success(`Ditambahkan: ${item.productName} ×${item.quantity}`)
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.items.length) return toast.error('Tambahkan minimal 1 item')
    create.mutate({
      WarehouseId: form.warehouseId,
      note:        form.note,
      items:       form.items.map(i => ({ ProductId: i.productId, quantity: i.quantity })),
    })
  }

  const columns = [
    { key: 'id',        label: '#',        width: 60,  render: r => <span className="font-mono text-xs text-slate-400">{r.id}</span> },
    { key: 'warehouse', label: 'Gudang',            render: r => <span className="font-semibold text-slate-800">{r.Warehouse?.name ?? '—'}</span> },
    { key: 'note',      label: 'Catatan',                 render: r => <span className="text-xs text-slate-400">{r.note || '—'}</span> },
    { key: 'date',      label: 'Tanggal',                 render: r => <span className="text-xs text-slate-400">{new Date(r.createdAt).toLocaleDateString('id-ID')}</span> },
    { key: 'actions', label: '', width: 130, render: r => (
      <button onClick={() => setModal({ mode: 'view', data: r })} className="btn-secondary text-[10px] px-2 py-0.5 flex items-center gap-1 rounded">
        <Eye size={10} />
        Lihat Detail
      </button>
    )},
  ]

  return (
    <div className="px-6 py-6">
      <PageHeader
        title="Pengeluaran Stok"
        subtitle={`${data?.pagination?.total ?? 0} transaksi`}
        action={
          <button
            onClick={() => { setForm(EMPTY_FORM); setManualItem({ productId: '', quantity: '' }); setModal({ mode: 'create' }) }}
            className="btn-primary"
          >
            <PackageMinus size={14} /> New Stock OUT
          </button>
        }
      />

      <div className="card overflow-hidden">
        <Table columns={columns} data={data?.data} loading={isLoading} emptyText="Belum ada transaksi stock out" />
        <Pagination pagination={data?.pagination} onPageChange={setPage} />
      </div>

      {/* ── Create modal ──────────────────────────────────────────────────────── */}
      <Modal open={modal?.mode === 'create'} onClose={() => setModal(null)} title="New Stock OUT Transaction" size="xl">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Warehouse <span className="text-danger">*</span></label>
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
              <label className="label">Note</label>
              <input className="input" placeholder="Catatan (opsional)…" value={form.note}
                onChange={e => setForm(f => ({ ...f, note: e.target.value }))} />
            </div>
          </div>

          {/* Items section */}
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <PackageMinus size={13} className="text-danger" />
                <span className="text-xs font-bold text-slate-600 uppercase tracking-wide">Items</span>
                {!form.warehouseId && <span className="ml-2 text-xs text-slate-400">Pilih warehouse dulu</span>}
              </div>
              <button
                type="button"
                onClick={() => setShowScanner(true)}
                disabled={!form.warehouseId}
                className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-brand hover:border-brand/40 hover:bg-brand/5 px-2.5 py-1 rounded border border-slate-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ScanLine size={13} /> Scan QR
              </button>
            </div>

            {/* Input row */}
            <div className="p-3 border-b border-slate-100 bg-white">
              {canManualOutput ? (
                <div className="flex gap-2">
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
                  <input
                    className="input w-24"
                    type="number" min="1" placeholder="Qty"
                    value={manualItem.quantity}
                    onChange={e => setManualItem(i => ({ ...i, quantity: e.target.value }))}
                    disabled={!form.warehouseId}
                  />
                  <button type="button" onClick={addManualItem} className="btn-primary px-3" disabled={!form.warehouseId}>
                    <Plus size={14} />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-3 py-2 px-1">
                  <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center flex-shrink-0">
                    <ScanLine size={18} className="text-amber-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-700">Wajib scan barcode</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Role Anda tidak memiliki izin input manual. Klik <strong>Scan QR</strong> di atas untuk menambah item.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Items list */}
            {!form.items.length ? (
              <p className="text-center text-slate-400 text-sm py-5 bg-white">Belum ada item</p>
            ) : (
              <table className="w-full bg-white text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="th py-2">Produk</th>
                    <th className="th py-2 text-right w-20">Qty</th>
                    <th className="th py-2 text-right w-24">Tersedia</th>
                    <th className="th py-2 w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {form.items.map((it, idx) => (
                    <tr key={idx} className="tr border-b border-slate-50">
                      <td className="td py-2">{it.productName}</td>
                      <td className="td py-2 text-right font-mono font-semibold text-danger">{it.quantity}</td>
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
            )}
          </div>

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={() => setModal(null)} className="btn-secondary flex-1 justify-center">Batal</button>
            <button type="submit" disabled={create.isPending} className="btn-primary flex-1 justify-center">
              {create.isPending ? 'Menyimpan…' : 'Submit Stock OUT'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── View modal ───────────────────────────────────────────────────────── */}
      <Modal open={modal?.mode === 'view'} onClose={() => setModal(null)} title={`Stock OUT #${modal?.data?.id}`} size="sm">
        {modal?.data && (
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Warehouse</label><p className="font-semibold text-slate-800">{modal.data.Warehouse?.name ?? '—'}</p></div>
              <div><label className="label">Tanggal</label><p className="font-mono text-xs text-slate-500">{new Date(modal.data.createdAt).toLocaleString('id-ID')}</p></div>
              <div className="col-span-2"><label className="label">Note</label><p className="text-slate-500">{modal.data.note || '—'}</p></div>
            </div>
            <button onClick={() => setModal(null)} className="btn-secondary w-full justify-center mt-3">Tutup</button>
          </div>
        )}
      </Modal>

      {/* ── QR Scanner ───────────────────────────────────────────────────────── */}
      {showScanner && (
        <QRScanner
          onScan={handleScan}
          onClose={() => setShowScanner(false)}
          hint="Scan QR / barcode SKU produk untuk Stock OUT"
        />
      )}

      {/* ── Scan confirm popup ───────────────────────────────────────────────── */}
      {scanConfirm && (
        <ScanConfirm
          sku={scanConfirm.sku}
          available={scanConfirm.available}
          onConfirm={handleScanConfirm}
          onCancel={() => setScanConfirm(null)}
        />
      )}
    </div>
  )
}
