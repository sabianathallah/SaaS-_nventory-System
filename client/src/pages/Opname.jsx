import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { opnameSessionsApi, opnameItemsApi, warehousesApi, stocksApi } from '../api'
import PageHeader from '../components/PageHeader'
import { Table, Pagination } from '../components/Table'
import Modal from '../components/Modal'
import toast from 'react-hot-toast'
import { Plus, Eye, CheckCircle, ClipboardList } from 'lucide-react'

const STATUS_BADGE = {
  open:   <span className="badge-amber">● Open</span>,
  closed: <span className="badge-green">✓ Closed</span>,
}

export default function Opname() {
  const qc = useQueryClient()
  const [page, setPage]   = useState(1)
  const [modal, setModal] = useState(null)
  const [form, setForm]   = useState({ warehouseId: '', note: '' })
  const [items, setItems] = useState([])

  const { data, isLoading } = useQuery({
    queryKey: ['opname', { page }],
    queryFn:  () => opnameSessionsApi.list({ page, limit: 10 }),
  })
  const { data: warehouses } = useQuery({
    queryKey: ['warehouses', { limit: 100 }],
    queryFn:  () => warehousesApi.list({ limit: 100 }),
  })
  const { data: stocks } = useQuery({
    queryKey: ['stocks', { WarehouseId: modal?.data?.WarehouseId || form.warehouseId, limit: 200 }],
    queryFn:  () => stocksApi.list({ WarehouseId: modal?.data?.WarehouseId || form.warehouseId, limit: 200 }),
    enabled:  !!(modal?.data?.WarehouseId || form.warehouseId),
  })

  const create = useMutation({
    mutationFn: d => opnameSessionsApi.create(d),
    onSuccess: () => { qc.invalidateQueries(['opname']); toast.success('Session created'); setModal(null) },
    onError: e => toast.error(e.response?.data?.message || 'Error'),
  })
  const closeSession = useMutation({
    mutationFn: id => opnameSessionsApi.update(id, { status: 'closed' }),
    onSuccess: () => { qc.invalidateQueries(['opname']); qc.invalidateQueries(['stocks']); toast.success('Session closed — stock adjusted'); setModal(null) },
    onError: e => toast.error(e.response?.data?.message || 'Error'),
  })
  const saveItem = useMutation({
    mutationFn: ({ sessionId, productId, actualQty }) =>
      opnameItemsApi.create({ StockOpnameSessionId: sessionId, ProductId: productId, actualQty }),
    onError: e => toast.error(e.response?.data?.message || 'Error'),
  })

  const openView = (session) => {
    const init = stocks?.data?.map(s => ({ productId: s.ProductId, productName: s.Product?.name, systemQty: s.quantity, actualQty: '' })) ?? []
    setItems(init)
    setModal({ mode: 'view', data: session })
  }

  const submitItems = async (sessionId) => {
    const filled = items.filter(i => i.actualQty !== '')
    if (!filled.length) return toast.error('Enter actual quantities first')
    for (const it of filled) {
      await saveItem.mutateAsync({ sessionId, productId: it.productId, actualQty: Number(it.actualQty) })
    }
    toast.success('Items saved')
  }

  const columns = [
    { key: 'id',        label: '#',        width: 60,  render: r => <span className="font-mono text-xs text-slate-400">{r.id}</span> },
    { key: 'warehouse', label: 'Warehouse',            render: r => <span className="font-semibold text-slate-800">{r.Warehouse?.name ?? '—'}</span> },
    { key: 'status',    label: 'Status',    width: 100, render: r => STATUS_BADGE[r.status] ?? <span className="badge-muted">{r.status}</span> },
    { key: 'note',      label: 'Note',                 render: r => <span className="text-xs text-slate-400">{r.note || '—'}</span> },
    { key: 'date',      label: 'Created',              render: r => <span className="text-xs text-slate-400">{new Date(r.createdAt).toLocaleDateString()}</span> },
    { key: 'actions',   label: '', width: 90, render: r => (
      <div className="flex gap-1">
        <button onClick={() => openView(r)} className="p-1.5 rounded text-slate-400 hover:text-info hover:bg-info-light transition-colors"><Eye size={13} /></button>
        {r.status === 'open' && (
          <button onClick={() => setModal({ mode: 'close', data: r })} className="p-1.5 rounded text-slate-400 hover:text-success hover:bg-success-light transition-colors" title="Close & adjust stock"><CheckCircle size={13} /></button>
        )}
      </div>
    )},
  ]

  return (
    <div className="px-6 py-6">
      <PageHeader title="Stock Opname" subtitle={`${data?.pagination?.total ?? 0} sessions`}
        action={<button onClick={() => { setForm({ warehouseId: '', note: '' }); setModal({ mode: 'create' }) }} className="btn-primary"><Plus size={14} />New Session</button>}
      />

      <div className="card overflow-hidden">
        <Table columns={columns} data={data?.data} loading={isLoading} emptyText="No opname sessions yet" />
        <Pagination pagination={data?.pagination} onPageChange={setPage} />
      </div>

      {/* Create */}
      <Modal open={modal?.mode === 'create'} onClose={() => setModal(null)} title="New Opname Session">
        <form onSubmit={e => { e.preventDefault(); create.mutate({ WarehouseId: form.warehouseId, note: form.note }) }} className="space-y-4">
          <div>
            <label className="label">Warehouse <span className="text-danger">*</span></label>
            <select className="select" value={form.warehouseId} onChange={e => setForm(f => ({ ...f, warehouseId: e.target.value }))} required>
              <option value="">Select warehouse…</option>
              {warehouses?.data?.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Note</label>
            <input className="input" placeholder="Optional note…" value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} />
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={() => setModal(null)} className="btn-secondary flex-1 justify-center">Cancel</button>
            <button type="submit" disabled={create.isPending} className="btn-primary flex-1 justify-center">{create.isPending ? 'Creating…' : 'Create Session'}</button>
          </div>
        </form>
      </Modal>

      {/* View / Fill */}
      <Modal open={modal?.mode === 'view'} onClose={() => setModal(null)} title={`Opname Session #${modal?.data?.id}`} size="xl">
        {modal?.data && (
          <div className="space-y-4">
            <div className="flex items-center gap-4 pb-3 border-b border-slate-100">
              <span className="text-sm font-semibold text-slate-700">{modal.data.Warehouse?.name}</span>
              {STATUS_BADGE[modal.data.status]}
            </div>

            {modal.data.status === 'open' && stocks?.data?.length > 0 && (
              <>
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200">
                    <span className="text-xs font-bold text-slate-600 uppercase tracking-wide">Enter Actual Quantities</span>
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead><tr className="bg-slate-50 border-b border-slate-100">
                        <th className="th py-2">Product</th>
                        <th className="th py-2 text-right">System Qty</th>
                        <th className="th py-2 w-36">Actual Qty</th>
                      </tr></thead>
                      <tbody>
                        {stocks.data.map((s, idx) => (
                          <tr key={s.id} className="tr border-b border-slate-50">
                            <td className="td py-2 font-medium">{s.Product?.name}</td>
                            <td className="td py-2 text-right font-mono text-slate-500">{s.quantity}</td>
                            <td className="td py-2">
                              <input
                                className="input py-1 text-center font-mono text-sm"
                                type="number" min="0" placeholder="—"
                                value={items[idx]?.actualQty ?? ''}
                                onChange={e => setItems(prev => prev.map((it, i) => i === idx ? { ...it, actualQty: e.target.value } : it))}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                <button onClick={() => submitItems(modal.data.id)} disabled={saveItem.isPending} className="btn-primary w-full justify-center">
                  {saveItem.isPending ? 'Saving…' : 'Save Actual Quantities'}
                </button>
              </>
            )}

            <div className="flex gap-2 pt-1 border-t border-slate-100">
              <button onClick={() => setModal(null)} className="btn-secondary flex-1 justify-center">Close</button>
              {modal.data.status === 'open' && (
                <button onClick={() => setModal({ mode: 'close', data: modal.data })} className="btn-primary flex-1 justify-center">
                  <CheckCircle size={14} /> Close & Adjust Stock
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Close confirm */}
      <Modal open={modal?.mode === 'close'} onClose={() => setModal(null)} title="Close Opname Session" size="sm">
        <p className="text-sm text-slate-600 mb-2">This will close the session and adjust stock quantities based on actual counts.</p>
        <p className="text-xs text-warning font-semibold mb-5">This action cannot be undone.</p>
        <div className="flex gap-2">
          <button onClick={() => setModal(null)} className="btn-secondary flex-1 justify-center">Cancel</button>
          <button onClick={() => closeSession.mutate(modal.data.id)} disabled={closeSession.isPending} className="btn-primary flex-1 justify-center">
            {closeSession.isPending ? 'Closing…' : 'Close & Adjust'}
          </button>
        </div>
      </Modal>
    </div>
  )
}
