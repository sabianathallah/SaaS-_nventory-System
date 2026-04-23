import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { stockOutApi, productsApi, warehousesApi, stocksApi } from '../api'
import PageHeader from '../components/PageHeader'
import { Table, Pagination } from '../components/Table'
import Modal from '../components/Modal'
import QRScanner from '../components/QRScanner'
import toast from 'react-hot-toast'
import { Plus, Trash2, PackageMinus, Eye, AlertTriangle, ScanLine } from 'lucide-react'

const EMPTY_FORM = { warehouseId: '', note: '', items: [] }
const EMPTY_ITEM = { productId: '', quantity: '' }

export default function StockOut() {
  const qc = useQueryClient()
  const [page, setPage]       = useState(1)
  const [modal, setModal]     = useState(null)
  const [form, setForm]       = useState(EMPTY_FORM)
  const [item, setItem]       = useState(EMPTY_ITEM)
  const [showScanner, setShowScanner] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['stock-out', { page }],
    queryFn:  () => stockOutApi.list({ page, limit: 10 }),
  })
  const { data: products }   = useQuery({ queryKey: ['products',   { limit: 200 }], queryFn: () => productsApi.list({ limit: 200 }) })
  const { data: warehouses } = useQuery({ queryKey: ['warehouses', { limit: 100 }], queryFn: () => warehousesApi.list({ limit: 100 }) })
  const { data: stocks }     = useQuery({
    queryKey: ['stocks', { WarehouseId: form.warehouseId, limit: 200 }],
    queryFn:  () => stocksApi.list({ WarehouseId: form.warehouseId, limit: 200 }),
    enabled:  !!form.warehouseId && modal?.mode === 'create',
  })

  const create = useMutation({
    mutationFn: d => stockOutApi.create(d),
    onSuccess: () => {
      qc.invalidateQueries(['stock-out']); qc.invalidateQueries(['stocks'])
      toast.success('Stock OUT recorded successfully')
      setModal(null); setForm(EMPTY_FORM)
    },
    onError: e => toast.error(e.response?.data?.message || 'Error'),
  })

  const getAvail = (productId) =>
    stocks?.data?.find(s => String(s.ProductId) === String(productId))?.quantity ?? null

  const addItem = () => {
    if (!item.productId || !item.quantity) return toast.error('Select product and enter quantity')
    const qty   = Number(item.quantity)
    const avail = getAvail(item.productId)
    if (avail !== null && qty > avail) return toast.error(`Only ${avail} units available in this warehouse`)
    const prod = products?.data?.find(p => String(p.id) === String(item.productId))
    setForm(f => ({ ...f, items: [...f.items, { ...item, quantity: qty, productName: prod?.name, available: avail }] }))
    setItem(EMPTY_ITEM)
  }

  const handleQRScan = (code) => {
    if (!form.warehouseId) return toast.error('Pilih warehouse terlebih dahulu')
    const prod = products?.data?.find(p => p.sku === code || p.qrString === code || String(p.id) === code)
    if (!prod) return toast.error(`Produk dengan kode "${code}" tidak ditemukan`)
    setItem(prev => ({ ...prev, productId: String(prod.id) }))
    toast.success(`Produk dipilih: ${prod.name}`)
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.items.length) return toast.error('Add at least one item')
    create.mutate({
      WarehouseId: form.warehouseId,
      note:        form.note,
      items:       form.items.map(i => ({ ProductId: i.productId, quantity: i.quantity })),
    })
  }

  const overLimit = item.productId && form.warehouseId && (() => {
    const avail = getAvail(item.productId)
    return avail !== null && Number(item.quantity) > avail ? avail : null
  })()

  const columns = [
    { key: 'id',        label: '#',        width: 60,  render: r => <span className="font-mono text-xs text-slate-400">{r.id}</span> },
    { key: 'warehouse', label: 'Warehouse',            render: r => <span className="font-semibold text-slate-800">{r.Warehouse?.name ?? '—'}</span> },
    { key: 'note',      label: 'Note',                 render: r => <span className="text-xs text-slate-400">{r.note || '—'}</span> },
    { key: 'date',      label: 'Date',                 render: r => <span className="text-xs text-slate-400">{new Date(r.createdAt).toLocaleDateString()}</span> },
    { key: 'actions',   label: '', width: 60, render: r => (
      <button onClick={() => setModal({ mode: 'view', data: r })} className="p-1.5 rounded text-slate-400 hover:text-info hover:bg-info-light transition-colors">
        <Eye size={13} />
      </button>
    )},
  ]

  return (
    <div className="px-6 py-6">
      <PageHeader
        title="Stock OUT"
        subtitle={`${data?.pagination?.total ?? 0} transactions`}
        action={
          <button
            onClick={() => { setForm(EMPTY_FORM); setItem(EMPTY_ITEM); setModal({ mode: 'create' }) }}
            className="btn-primary"
          >
            <PackageMinus size={14} /> New Stock OUT
          </button>
        }
      />

      <div className="card overflow-hidden">
        <Table columns={columns} data={data?.data} loading={isLoading} emptyText="No stock-out transactions yet" />
        <Pagination pagination={data?.pagination} onPageChange={setPage} />
      </div>

      {/* ── Create modal ──────────────────────────────────────────────── */}
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
                <option value="">Select warehouse…</option>
                {warehouses?.data?.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Note</label>
              <input className="input" placeholder="Optional note…" value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} />
            </div>
          </div>

          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
              <PackageMinus size={13} className="text-danger" />
              <span className="text-xs font-bold text-slate-600 uppercase tracking-wide">Items</span>
              {!form.warehouseId && <span className="ml-auto text-xs text-slate-400">Select a warehouse first</span>}
            </div>

            <div className="p-3 bg-white flex gap-2 border-b border-slate-100">
              {/* Scan QR button */}
              <button
                type="button"
                onClick={() => setShowScanner(true)}
                disabled={!form.warehouseId}
                className="px-3 rounded-lg border border-slate-200 text-slate-400 hover:text-brand hover:border-brand/40 hover:bg-brand/5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
                title="Scan QR produk"
              >
                <ScanLine size={15} />
              </button>
              <select
                className="select flex-1"
                value={item.productId}
                onChange={e => setItem(i => ({ ...i, productId: e.target.value }))}
                disabled={!form.warehouseId}
              >
                <option value="">Select product…</option>
                {products?.data?.map(p => {
                  const avail = getAvail(p.id)
                  return <option key={p.id} value={p.id}>{p.name}{avail !== null ? ` (${avail} avail)` : ''}</option>
                })}
              </select>
              <input
                className="input w-24"
                type="number"
                min="1"
                placeholder="Qty"
                value={item.quantity}
                onChange={e => setItem(i => ({ ...i, quantity: e.target.value }))}
                disabled={!form.warehouseId}
              />
              <button type="button" onClick={addItem} className="btn-primary px-3" disabled={!form.warehouseId}>
                <Plus size={14} />
              </button>
            </div>

            {overLimit !== null && (
              <div className="px-4 py-2 bg-danger-light border-b border-danger-border flex items-center gap-2 text-danger text-xs font-semibold">
                <AlertTriangle size={12} /> Only {overLimit} units available
              </div>
            )}

            {!form.items.length ? (
              <p className="text-center text-slate-400 text-sm py-5 bg-white">No items added yet</p>
            ) : (
              <table className="w-full bg-white text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="th py-2">Product</th>
                    <th className="th py-2 text-right">Qty</th>
                    <th className="th py-2 text-right">Available</th>
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
                        <button type="button" onClick={() => setForm(f => ({ ...f, items: f.items.filter((_, i) => i !== idx) }))} className="p-1 text-slate-300 hover:text-danger transition-colors">
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
            <button type="button" onClick={() => setModal(null)} className="btn-secondary flex-1 justify-center">Cancel</button>
            <button type="submit" disabled={create.isPending} className="btn-primary flex-1 justify-center">
              {create.isPending ? 'Submitting…' : 'Submit Stock OUT'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── View modal ────────────────────────────────────────────────── */}
      <Modal open={modal?.mode === 'view'} onClose={() => setModal(null)} title={`Stock OUT #${modal?.data?.id}`} size="sm">
        {modal?.data && (
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Warehouse</label><p className="font-semibold text-slate-800">{modal.data.Warehouse?.name ?? '—'}</p></div>
              <div><label className="label">Date</label><p className="font-mono text-xs text-slate-500">{new Date(modal.data.createdAt).toLocaleString()}</p></div>
              <div className="col-span-2"><label className="label">Note</label><p className="text-slate-500">{modal.data.note || '—'}</p></div>
            </div>
            <button onClick={() => setModal(null)} className="btn-secondary w-full justify-center mt-3">Close</button>
          </div>
        )}
      </Modal>

      {/* ── QR Scanner overlay ────────────────────────────────────────── */}
      {showScanner && (
        <QRScanner
          onScan={handleQRScan}
          onClose={() => setShowScanner(false)}
          hint="Scan QR / barcode produk untuk auto-pilih"
        />
      )}
    </div>
  )
}
