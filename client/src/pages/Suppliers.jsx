import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { suppliersApi } from '../api'
import PageHeader from '../components/PageHeader'
import { Table, Pagination } from '../components/Table'
import Modal from '../components/Modal'
import SearchBar from '../components/SearchBar'
import toast from 'react-hot-toast'
import { Plus, Pencil, Trash2 } from 'lucide-react'

export default function Suppliers() {
  const qc = useQueryClient()
  const [page, setPage]     = useState(1)
  const [search, setSearch] = useState('')
  const [modal, setModal]   = useState(null)
  const [form, setForm]     = useState({ name: '', contact: '' })

  const { data, isLoading } = useQuery({
    queryKey: ['suppliers', { page, name: search }],
    queryFn:  () => suppliersApi.list({ page, limit: 10, name: search }),
  })

  const save = useMutation({
    mutationFn: d => modal.data ? suppliersApi.update(modal.data.id, d) : suppliersApi.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['suppliers'] }); toast.success(modal.data ? 'Vendor diperbarui' : 'Vendor dibuat'); setModal(null) },
    onError: e => toast.error(e.response?.data?.message || 'Error'),
  })
  const del = useMutation({
    mutationFn: id => suppliersApi.remove(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['suppliers'] }); toast.success('Vendor dihapus'); setModal(null) },
    onError: e => toast.error(e.response?.data?.message || 'Error'),
  })

  const columns = [
    { key: 'id',      label: '#',      width: 60,  render: r => <span className="font-mono text-xs text-slate-400">{r.id}</span> },
    { key: 'name',    label: 'Vendor',             render: r => <span className="font-semibold text-slate-800">{r.name}</span> },
    { key: 'contact', label: 'Kontak',             render: r => <span className="text-slate-500 text-sm">{r.contact || '—'}</span> },
    { key: 'actions', label: '', width: 80, render: r => (
      <div className="flex gap-1">
        <button onClick={() => { setForm({ name: r.name, contact: r.contact || '' }); setModal({ mode: 'edit', data: r }) }} className="p-1.5 rounded text-slate-400 btn-edit transition-colors"><Pencil size={13} /></button>
        <button onClick={() => setModal({ mode: 'delete', data: r })} className="p-1.5 rounded text-slate-400 hover:text-danger hover:bg-danger-light transition-colors"><Trash2 size={13} /></button>
      </div>
    )},
  ]

  return (
    <div className="px-6 py-6">
      <PageHeader title="Vendor" subtitle={`${data?.pagination?.total ?? 0} vendor`}
        action={<button onClick={() => { setForm({ name: '', contact: '' }); setModal({ mode: 'create' }) }} className="btn-primary"><Plus size={14} />Vendor Baru</button>}
      />
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
          <SearchBar value={search} onChange={v => { setSearch(v); setPage(1) }} placeholder="Cari vendor…" />
        </div>
        <Table columns={columns} data={data?.data} loading={isLoading} />
        <Pagination pagination={data?.pagination} onPageChange={setPage} />
      </div>

      <Modal open={['create','edit'].includes(modal?.mode)} onClose={() => setModal(null)}
        title={modal?.mode === 'edit' ? 'Edit Vendor' : 'Vendor Baru'}>
        <form onSubmit={e => { e.preventDefault(); save.mutate(form) }} className="space-y-4">
          <div>
            <label className="label">Nama Vendor</label>
            <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required autoFocus placeholder="cth. PT Vendor Indonesia" />
          </div>
          <div>
            <label className="label">Kontak (Telepon atau Email)</label>
            <input className="input" placeholder="+62 812 3456 7890" value={form.contact} onChange={e => setForm(f => ({ ...f, contact: e.target.value }))} />
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={() => setModal(null)} className="btn-secondary flex-1 justify-center">Batal</button>
            <button type="submit" disabled={save.isPending} className="btn-primary flex-1 justify-center">{save.isPending ? 'Menyimpan…' : 'Simpan'}</button>
          </div>
        </form>
      </Modal>

      <Modal open={modal?.mode === 'delete'} onClose={() => setModal(null)} title="Hapus Vendor" size="sm">
        <p className="text-sm text-slate-600 mb-5">Hapus <span className="font-semibold text-slate-800">"{modal?.data?.name}"</span>?</p>
        <div className="flex gap-2">
          <button onClick={() => setModal(null)} className="btn-secondary flex-1 justify-center">Batal</button>
          <button onClick={() => del.mutate(modal.data.id)} disabled={del.isPending} className="btn-danger flex-1 justify-center">{del.isPending ? 'Menghapus…' : 'Hapus'}</button>
        </div>
      </Modal>
    </div>
  )
}
