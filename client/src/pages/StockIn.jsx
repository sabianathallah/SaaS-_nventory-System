import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { stockInApi, productsApi, warehousesApi, suppliersApi } from '../api'
import PageHeader from '../components/PageHeader'
import { Table, Pagination } from '../components/Table'
import Modal from '../components/Modal'
import QRScanner from '../components/QRScanner'
import toast from 'react-hot-toast'
import { Plus, Trash2, PackagePlus, Eye, ScanLine } from 'lucide-react'

const EMPTY_FORM = { supplierId: '', warehouseId: '', note: '', items: [] }
const EMPTY_ITEM = { productId: '', quantity: '', price: '' }

export default function StockIn() {
  const qc = useQueryClient()
  const [page, setPage]         = useState(1)
  const [modal, setModal]       = useState(null)
  const [form, setForm]         = useState(EMPTY_FORM)
  const [item, setItem]         = useState(EMPTY_ITEM)
  const [showScanner, setShowScanner] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['stock-in', { page }],
    queryFn:  () => stockInApi.list({ page, limit: 10 }),
  })
  const { data: products }   = useQuery({ queryKey: ['products',   { limit: 200 }], queryFn: () => productsApi.list({ limit: 200 }) })
  const { data: warehouses } = useQuery({ queryKey: ['warehouses', { limit: 100 }], queryFn: () => warehousesApi.list({ limit: 100 }) })
  const { data: suppliers }  = useQuery({ queryKey: ['suppliers',  { limit: 100 }], queryFn: () => suppliersApi.list({ limit: 100 }) })

  const create = useMutation({
    mutationFn: d => stockInApi.create(d),
    onSuccess: () => {
      qc.invalidateQueries(['stock-in']); qc.invalidateQueries(['stocks'])
      toast.success('Stock IN recorded successfully'); setModal(null); setForm(EMPTY_FORM)
    },
    onError: e => toast.error(e.response?.data?.message || 'Error'),
  })

  const addItem = () => {
    if (!item.productId || !item.quantity) return toast.error('Select product and enter quantity')
    const prod = products?.data?.find(p => String(p.id) === String(item.productId))
    setForm(f => ({ ...f, items: [...f.items, { ...item, quantity: Number(item.quantity), price: Number(item.price) || 0, productName: prod?.name }] }))
    setItem(EMPTY_ITEM)
  }

  const handleQRScan = (code) => {
    const prod = products?.data?.find(p => p.sku === code || p.qrString === code || String(p.id) === code)
    if (!prod) return toast.error(`Produk dengan kode "${code}" tidak ditemukan`)
    setItem(prev => ({ ...prev, productId: String(prod.id) }))
    toast.success(`Produk dipilih: ${prod.name}`)
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.items.length) return toast.error('Add at least one item')
    create.mutate({
      SupplierId:  form.supplierId  || null,
      WarehouseId: form.warehouseId,
      note:        form.note,
      items:       form.items.map(i => ({ ProductId: i.productId, quantity: i.quantity, price: i.price })),
    })
  }

  const columns = [
    { key: 'id',        label: '#',        width: 60,  render: r => <span className="font-mono text-xs text-slate-400">{r.id}</span> },
    { key: 'warehouse', label: 'Warehouse',            render: r => <span className="font-semibold text-slate-800">{r.Warehouse?.name ?? '—'}</span> },
    { key: 'supplier',  label: 'Supplier',             render: r => <span className="text-slate-500">{r.Supplier?.name ?? <span className="text-slate-300">—</span>}</span> },
    { key: 'note',      label: 'Note',                 render: r => <span className="text-xs text-slate-400">{r.note || '—'}</span> },
    { key: 'date',      label: 'Date',                 render: r => <span className="text-xs text-slate-400">{new Date(r.createdAt).toLocaleDateString()}</span> },
    { key: 'actions',   label: '', width: 60, render: r => (
      <button onClick={() => setModal({ mode: 'view', data: r })} className="p-1.5 rounded text-slate-400 hover:text-info hover:bg-info-light transition-colors"><Eye size={13} /></button>
    )},
  ]

  return (
    <div className="px-6 py-6">
      <PageHeader title="Stock IN" subtitle={`${data?.pagination?.total ?? 0} transactions`}
        action={<button onClick={() => { setForm(EMPTY_FORM); setItem(EMPTY_ITEM); setModal({ mode: 'create' }) }} className="btn-primary"><PackagePlus size={14} />New Stock IN</button>}
      />

      <div className="card overflow-hidden">
        <Table columns={columns} data={data?.data} loading={isLoading} emptyText="No stock-in transactions yet" />
        <Pagination pagination={data?.pagination} onPageChange={setPage} />
      </div>

      {/* Create */}
      <Modal open={modal?.mode === 'create'} onClose={() => setModal(null)} title="New Stock IN Transaction" size="xl">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Warehouse <span className="text-danger">*</span></label>
              <select className="select" value={form.warehouseId} onChange={e => setForm(f => ({ ...f, warehouseId: e.target.value }))} required>
                <option value="">Select warehouse…</option>
                {warehouses?.data?.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Supplier</label>
              <select className="select" value={form.supplierId} onChange={e => setForm(f => ({ ...f, supplierId: e.target.value }))}>
                <option value="">Select supplier…</option>
                {suppliers?.data?.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="label">Note</label>
              <input className="input" placeholder="Optional note…" value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} />
            </div>
          </div>

          {/* Items */}
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
              <PackagePlus size={13} className="text-red-700" />
              <span className="text-xs font-bold text-slate-600 uppercase tracking-wide">Items</span>
            </div>
            <div className="p-3 bg-white flex gap-2 border-b border-slate-100">
              <button
                type="button"
                onClick={() => setShowScanner(true)}
                className="px-3 rounded-lg border border-slate-200 text-slate-400 hover:text-brand hover:border-brand/40 hover:bg-brand/5 transition-colors flex-shrink-0"
                title="Scan QR produk"
              >
                <ScanLine size={15} />
              </button>
              <select className="select flex-1" value={item.productId} onChange={e => setItem(i => ({ ...i, productId: e.target.value }))}>
                <option value="">Select product…</option>
                {products?.data?.map(p => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
              </select>
              <input className="input w-24" type="number" min="1" placeholder="Qty" value={item.quantity} onChange={e => setItem(i => ({ ...i, quantity: e.target.value }))} />
              <input className="input w-28" type="number" min="0" placeholder="Price" value={item.price} onChange={e => setItem(i => ({ ...i, price: e.target.value }))} />
              <button type="button" onClick={addItem} className="btn-primary px-3"><Plus size={14} /></button>
            </div>
            {!form.items.length ? (
              <p className="text-center text-slate-400 text-sm py-5 bg-white">No items added yet</p>
            ) : (
              <table className="w-full bg-white text-sm">
                <thead><tr className="bg-slate-50 border-b border-slate-100">
                  <th className="th py-2">Product</th><th className="th py-2 text-right">Qty</th><th className="th py-2 text-right">Price</th><th className="th py-2 w-10"></th>
                </tr></thead>
                <tbody>
                  {form.items.map((it, idx) => (
                    <tr key={idx} className="tr border-b border-slate-50">
                      <td className="td py-2">{it.productName}</td>
                      <td className="td py-2 text-right font-mono font-semibold text-success">{it.quantity}</td>
                      <td className="td py-2 text-right font-mono text-slate-400">{it.price ? it.price.toLocaleString() : '—'}</td>
                      <td className="td py-2"><button type="button" onClick={() => setForm(f => ({ ...f, items: f.items.filter((_, i) => i !== idx) }))} className="p-1 text-slate-300 hover:text-danger transition-colors"><Trash2 size={12} /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={() => setModal(null)} className="btn-secondary flex-1 justify-center">Cancel</button>
            <button type="submit" disabled={create.isPending} className="btn-primary flex-1 justify-center">{create.isPending ? 'Submitting…' : 'Submit Stock IN'}</button>
          </div>
        </form>
      </Modal>

      {showScanner && (
        <QRScanner
          onScan={handleQRScan}
          onClose={() => setShowScanner(false)}
          hint="Scan QR / barcode produk untuk auto-pilih"
        />
      )}

      {/* View */}
      <Modal open={modal?.mode === 'view'} onClose={() => setModal(null)} title={`Stock IN #${modal?.data?.id}`} size="sm">
        {modal?.data && (
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Warehouse</label><p className="font-semibold text-slate-800">{modal.data.Warehouse?.name ?? '—'}</p></div>
              <div><label className="label">Supplier</label><p className="text-slate-600">{modal.data.Supplier?.name ?? '—'}</p></div>
              <div><label className="label">Date</label><p className="font-mono text-xs text-slate-500">{new Date(modal.data.createdAt).toLocaleString()}</p></div>
              <div><label className="label">Note</label><p className="text-slate-500">{modal.data.note || '—'}</p></div>
            </div>
            <button onClick={() => setModal(null)} className="btn-secondary w-full justify-center mt-3">Close</button>
          </div>
        )}
      </Modal>
    </div>
  )
}
