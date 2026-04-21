import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { categoriesApi } from '../api'
import PageHeader from '../components/PageHeader'
import { Table, Pagination } from '../components/Table'
import Modal from '../components/Modal'
import SearchBar from '../components/SearchBar'
import toast from 'react-hot-toast'
import { Plus, Pencil, Trash2 } from 'lucide-react'

export default function Categories() {
  const qc = useQueryClient()
  const [page, setPage]     = useState(1)
  const [search, setSearch] = useState('')
  const [modal, setModal]   = useState(null)
  const [form, setForm]     = useState({ name: '' })

  const { data, isLoading } = useQuery({
    queryKey: ['categories', { page, name: search }],
    queryFn:  () => categoriesApi.list({ page, limit: 10, name: search }),
  })

  const save = useMutation({
    mutationFn: d => modal.data ? categoriesApi.update(modal.data.id, d) : categoriesApi.create(d),
    onSuccess: () => { qc.invalidateQueries(['categories']); toast.success(modal.data ? 'Category updated' : 'Category created'); setModal(null) },
    onError: e => toast.error(e.response?.data?.message || 'Error'),
  })
  const del = useMutation({
    mutationFn: id => categoriesApi.remove(id),
    onSuccess: () => { qc.invalidateQueries(['categories']); toast.success('Category deleted'); setModal(null) },
    onError: e => toast.error(e.response?.data?.message || 'Error'),
  })

  const columns = [
    { key: 'id',   label: '#',    width: 60,  render: r => <span className="font-mono text-xs text-slate-400">{r.id}</span> },
    { key: 'name', label: 'Name',             render: r => <span className="font-semibold text-slate-800">{r.name}</span> },
    { key: 'date', label: 'Created',          render: r => <span className="text-xs text-slate-400">{new Date(r.createdAt).toLocaleDateString()}</span> },
    { key: 'actions', label: '', width: 80, render: r => (
      <div className="flex gap-1">
        <button onClick={() => { setForm({ name: r.name }); setModal({ mode: 'edit', data: r }) }} className="p-1.5 rounded text-slate-400 btn-edit transition-colors"><Pencil size={13} /></button>
        <button onClick={() => setModal({ mode: 'delete', data: r })} className="p-1.5 rounded text-slate-400 hover:text-danger hover:bg-danger-light transition-colors"><Trash2 size={13} /></button>
      </div>
    )},
  ]

  return (
    <div className="px-6 py-6">
      <PageHeader title="Categories" subtitle={`${data?.pagination?.total ?? 0} total categories`}
        action={<button onClick={() => { setForm({ name: '' }); setModal({ mode: 'create' }) }} className="btn-primary"><Plus size={14} />Add Category</button>}
      />
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
          <SearchBar value={search} onChange={v => { setSearch(v); setPage(1) }} placeholder="Search categories…" />
        </div>
        <Table columns={columns} data={data?.data} loading={isLoading} />
        <Pagination pagination={data?.pagination} onPageChange={setPage} />
      </div>

      <Modal open={['create','edit'].includes(modal?.mode)} onClose={() => setModal(null)}
        title={modal?.mode === 'edit' ? 'Edit Category' : 'New Category'}>
        <form onSubmit={e => { e.preventDefault(); save.mutate(form) }} className="space-y-4">
          <div>
            <label className="label">Category Name</label>
            <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required autoFocus placeholder="e.g. Electronics" />
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={() => setModal(null)} className="btn-secondary flex-1 justify-center">Cancel</button>
            <button type="submit" disabled={save.isPending} className="btn-primary flex-1 justify-center">{save.isPending ? 'Saving…' : 'Save'}</button>
          </div>
        </form>
      </Modal>

      <Modal open={modal?.mode === 'delete'} onClose={() => setModal(null)} title="Delete Category" size="sm">
        <p className="text-sm text-slate-600 mb-5">Delete <span className="text-slate-800 font-semibold">"{modal?.data?.name}"</span>? This cannot be undone.</p>
        <div className="flex gap-2">
          <button onClick={() => setModal(null)} className="btn-secondary flex-1 justify-center">Cancel</button>
          <button onClick={() => del.mutate(modal.data.id)} disabled={del.isPending} className="btn-danger flex-1 justify-center">{del.isPending ? 'Deleting…' : 'Delete'}</button>
        </div>
      </Modal>
    </div>
  )
}
