import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { companiesApi } from '../api'
import PageHeader from '../components/PageHeader'
import { Table, Pagination } from '../components/Table'
import Modal from '../components/Modal'
import SearchBar from '../components/SearchBar'
import toast from 'react-hot-toast'
import { Plus, Pencil, Trash2, Building2 } from 'lucide-react'

const EMPTY = { name: '', slug: '', logo: '', status: 'active', subscriptionExpiresAt: '' }

const STATUS_BADGE = {
  active:    <span className="badge-green">Active</span>,
  inactive:  <span className="badge-muted">Inactive</span>,
  suspended: <span className="badge-red">Suspended</span>,
}

export default function Companies() {
  const qc = useQueryClient()
  const [page, setPage]     = useState(1)
  const [search, setSearch] = useState('')
  const [modal, setModal]   = useState(null)
  const [form, setForm]     = useState(EMPTY)

  const { data, isLoading } = useQuery({
    queryKey: ['companies', { page, name: search }],
    queryFn:  () => companiesApi.list({ page, limit: 10, name: search }),
  })

  const save = useMutation({
    mutationFn: d => modal.data ? companiesApi.update(modal.data.id, d) : companiesApi.create(d),
    onSuccess: () => { qc.invalidateQueries(['companies']); toast.success(modal.data ? 'Company updated' : 'Company created'); setModal(null) },
    onError: e => toast.error(e.response?.data?.message || 'Error'),
  })
  const del = useMutation({
    mutationFn: id => companiesApi.remove(id),
    onSuccess: () => { qc.invalidateQueries(['companies']); toast.success('Company deleted'); setModal(null) },
    onError: e => toast.error(e.response?.data?.message || 'Error'),
  })

  const openEdit = (r) => {
    setForm({ name: r.name, slug: r.slug, logo: r.logo ?? '', status: r.status,
      subscriptionExpiresAt: r.subscriptionExpiresAt ? r.subscriptionExpiresAt.slice(0, 10) : '' })
    setModal({ mode: 'edit', data: r })
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const payload = { ...form }
    if (!payload.logo) delete payload.logo
    if (!payload.subscriptionExpiresAt) delete payload.subscriptionExpiresAt
    save.mutate(payload)
  }

  const columns = [
    { key: 'name',    label: 'Company', render: r => (
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center flex-shrink-0">
          <Building2 size={14} className="text-slate-400" />
        </div>
        <div>
          <p className="font-semibold text-slate-800">{r.name}</p>
          <p className="text-xs font-mono text-slate-400">{r.slug}</p>
        </div>
      </div>
    )},
    { key: 'status',  label: 'Status',  width: 110, render: r => STATUS_BADGE[r.status] ?? <span className="badge-muted">{r.status}</span> },
    { key: 'expires', label: 'Expires',             render: r => r.subscriptionExpiresAt
      ? <span className="text-xs text-slate-500">{new Date(r.subscriptionExpiresAt).toLocaleDateString()}</span>
      : <span className="text-slate-300 text-xs">—</span>
    },
    { key: 'created', label: 'Created',             render: r => <span className="text-xs text-slate-400">{new Date(r.createdAt).toLocaleDateString()}</span> },
    { key: 'actions', label: '', width: 80, render: r => (
      <div className="flex gap-1">
        <button onClick={() => openEdit(r)} className="p-1.5 rounded text-slate-400 btn-edit transition-colors"><Pencil size={13} /></button>
        <button onClick={() => setModal({ mode: 'delete', data: r })} className="p-1.5 rounded text-slate-400 hover:text-danger hover:bg-danger-light transition-colors"><Trash2 size={13} /></button>
      </div>
    )},
  ]

  return (
    <div className="px-6 py-6">
      <PageHeader title="Companies" subtitle={`${data?.pagination?.total ?? 0} total companies`}
        action={<button onClick={() => { setForm(EMPTY); setModal({ mode: 'create' }) }} className="btn-primary"><Plus size={14} />Add Company</button>}
      />

      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
          <SearchBar value={search} onChange={v => { setSearch(v); setPage(1) }} placeholder="Search companies…" />
        </div>
        <Table columns={columns} data={data?.data} loading={isLoading} />
        <Pagination pagination={data?.pagination} onPageChange={setPage} />
      </div>

      <Modal open={['create','edit'].includes(modal?.mode)} onClose={() => setModal(null)}
        title={modal?.mode === 'edit' ? 'Edit Company' : 'New Company'} size="md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="label">Company Name</label>
              <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required autoFocus placeholder="PT Maju Bersama" />
            </div>
            <div>
              <label className="label">Slug</label>
              <input className="input font-mono text-xs" value={form.slug} onChange={e => setForm(f => ({ ...f, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') }))} required placeholder="pt-maju-bersama" />
            </div>
            <div>
              <label className="label">Status</label>
              <select className="select" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="suspended">Suspended</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="label">Logo URL</label>
              <input className="input" type="url" value={form.logo} onChange={e => setForm(f => ({ ...f, logo: e.target.value }))} placeholder="https://…" />
            </div>
            <div className="col-span-2">
              <label className="label">Subscription Expires At</label>
              <input className="input" type="date" value={form.subscriptionExpiresAt} onChange={e => setForm(f => ({ ...f, subscriptionExpiresAt: e.target.value }))} />
            </div>
          </div>
          <div className="flex gap-2 pt-2 border-t border-slate-100">
            <button type="button" onClick={() => setModal(null)} className="btn-secondary flex-1 justify-center">Cancel</button>
            <button type="submit" disabled={save.isPending} className="btn-primary flex-1 justify-center">{save.isPending ? 'Saving…' : 'Save Company'}</button>
          </div>
        </form>
      </Modal>

      <Modal open={modal?.mode === 'delete'} onClose={() => setModal(null)} title="Delete Company" size="sm">
        <p className="text-sm text-slate-600 mb-2">Delete <span className="font-semibold text-slate-800">"{modal?.data?.name}"</span>?</p>
        <p className="text-xs text-danger font-semibold mb-5">All associated data will be permanently removed.</p>
        <div className="flex gap-2">
          <button onClick={() => setModal(null)} className="btn-secondary flex-1 justify-center">Cancel</button>
          <button onClick={() => del.mutate(modal.data.id)} disabled={del.isPending} className="btn-danger flex-1 justify-center">{del.isPending ? 'Deleting…' : 'Delete'}</button>
        </div>
      </Modal>
    </div>
  )
}
