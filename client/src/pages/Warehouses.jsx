import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { warehousesApi } from '../api'
import PageHeader from '../components/PageHeader'
import { Table, Pagination } from '../components/Table'
import Modal from '../components/Modal'
import SearchBar from '../components/SearchBar'
import toast from 'react-hot-toast'
import { Plus, Pencil, Trash2, Package } from 'lucide-react'

export default function Warehouses() {
  const qc       = useQueryClient()
  const navigate = useNavigate()
  const [page, setPage]     = useState(1)
  const [search, setSearch] = useState('')
  const [modal, setModal]   = useState(null)
  const [form, setForm]     = useState({ name: '', location: '' })

  const { data, isLoading } = useQuery({
    queryKey: ['warehouses', { page, name: search }],
    queryFn:  () => warehousesApi.list({ page, limit: 10, name: search }),
  })

  const save = useMutation({
    mutationFn: d => modal.data ? warehousesApi.update(modal.data.id, d) : warehousesApi.create(d),
    onSuccess: () => { qc.invalidateQueries(['warehouses']); toast.success(modal.data ? 'Warehouse updated' : 'Warehouse created'); setModal(null) },
    onError: e => toast.error(e.response?.data?.message || 'Error'),
  })
  const del = useMutation({
    mutationFn: id => warehousesApi.remove(id),
    onSuccess: () => { qc.invalidateQueries(['warehouses']); toast.success('Warehouse deleted'); setModal(null) },
    onError: e => toast.error(e.response?.data?.message || 'Error'),
  })

  const columns = [
    { key: 'id',       label: '#',         width: 60,  render: r => <span className="font-mono text-xs text-slate-400">{r.id}</span> },
    { key: 'name',     label: 'Warehouse',             render: r => <span className="font-semibold text-slate-800">{r.name}</span> },
    { key: 'location', label: 'Location',              render: r => <span className="text-slate-500 text-sm">{r.location}</span> },
    { key: 'actions',  label: '', width: 120, render: r => (
      <div className="flex items-center gap-1 justify-end">
        <button
          onClick={() => navigate(`/warehouses/${r.id}/products`)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-brand bg-brand/5 hover:bg-brand/10 border border-brand/20 transition-colors"
          title="Lihat produk di gudang ini"
        >
          <Package size={12} /> Produk
        </button>
        <button onClick={() => { setForm({ name: r.name, location: r.location }); setModal({ mode: 'edit', data: r }) }} className="p-1.5 rounded text-slate-400 btn-edit transition-colors"><Pencil size={13} /></button>
        <button onClick={() => setModal({ mode: 'delete', data: r })} className="p-1.5 rounded text-slate-400 hover:text-danger hover:bg-danger-light transition-colors"><Trash2 size={13} /></button>
      </div>
    )},
  ]

  return (
    <div className="px-6 py-6">
      <PageHeader title="Warehouses" subtitle={`${data?.pagination?.total ?? 0} total warehouses`}
        action={<button onClick={() => { setForm({ name: '', location: '' }); setModal({ mode: 'create' }) }} className="btn-primary"><Plus size={14} />Add Warehouse</button>}
      />
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
          <SearchBar value={search} onChange={v => { setSearch(v); setPage(1) }} placeholder="Search warehouses…" />
        </div>
        <Table columns={columns} data={data?.data} loading={isLoading} />
        <Pagination pagination={data?.pagination} onPageChange={setPage} />
      </div>

      <Modal open={['create','edit'].includes(modal?.mode)} onClose={() => setModal(null)}
        title={modal?.mode === 'edit' ? 'Edit Warehouse' : 'New Warehouse'}>
        <form onSubmit={e => { e.preventDefault(); save.mutate(form) }} className="space-y-4">
          <div>
            <label className="label">Warehouse Name</label>
            <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required autoFocus placeholder="e.g. Main Warehouse" />
          </div>
          <div>
            <label className="label">Location</label>
            <input className="input" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} required placeholder="e.g. Jakarta, Indonesia" />
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={() => setModal(null)} className="btn-secondary flex-1 justify-center">Cancel</button>
            <button type="submit" disabled={save.isPending} className="btn-primary flex-1 justify-center">{save.isPending ? 'Saving…' : 'Save'}</button>
          </div>
        </form>
      </Modal>

      <Modal open={modal?.mode === 'delete'} onClose={() => setModal(null)} title="Delete Warehouse" size="sm">
        <p className="text-sm text-slate-600 mb-5">Delete <span className="font-semibold text-slate-800">"{modal?.data?.name}"</span>? This cannot be undone.</p>
        <div className="flex gap-2">
          <button onClick={() => setModal(null)} className="btn-secondary flex-1 justify-center">Cancel</button>
          <button onClick={() => del.mutate(modal.data.id)} disabled={del.isPending} className="btn-danger flex-1 justify-center">{del.isPending ? 'Deleting…' : 'Delete'}</button>
        </div>
      </Modal>
    </div>
  )
}
