import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { usersApi } from '../api'
import PageHeader from '../components/PageHeader'
import { Table, Pagination } from '../components/Table'
import Modal from '../components/Modal'
import SearchBar from '../components/SearchBar'
import toast from 'react-hot-toast'
import { Plus, Pencil, Trash2, UserCircle2 } from 'lucide-react'

const ROLES = ['superadmin', 'admin', 'staff']
const EMPTY = { name: '', email: '', password: '', role: 'staff', CompanyId: '' }

const ROLE_BADGE = {
  superadmin: <span className="badge-brand font-semibold uppercase tracking-wide text-xs">Superadmin</span>,
  admin:      <span className="badge-blue text-xs uppercase tracking-wide">Admin</span>,
  staff:      <span className="badge-muted text-xs uppercase tracking-wide">Staff</span>,
}

export default function Users() {
  const qc = useQueryClient()
  const [page, setPage]     = useState(1)
  const [search, setSearch] = useState('')
  const [modal, setModal]   = useState(null)
  const [form, setForm]     = useState(EMPTY)

  const { data, isLoading } = useQuery({
    queryKey: ['users', { page, name: search }],
    queryFn:  () => usersApi.list({ page, limit: 10, name: search }),
  })

  const save = useMutation({
    mutationFn: d => {
      const payload = { ...d }
      if (modal?.data && !payload.password) delete payload.password
      return modal?.data ? usersApi.update(modal.data.id, payload) : usersApi.create(payload)
    },
    onSuccess: () => {
      qc.invalidateQueries(['users'])
      toast.success(modal?.data ? 'User updated' : 'User created')
      setModal(null)
    },
    onError: e => toast.error(e.response?.data?.message || 'Error'),
  })

  const del = useMutation({
    mutationFn: id => usersApi.remove(id),
    onSuccess: () => { qc.invalidateQueries(['users']); toast.success('User deleted'); setModal(null) },
    onError: e => toast.error(e.response?.data?.message || 'Error'),
  })

  const openEdit = (r) => {
    setForm({ name: r.name, email: r.email, password: '', role: r.role, CompanyId: r.CompanyId ?? '' })
    setModal({ mode: 'edit', data: r })
  }

  const initials = (name = '') => name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()

  const columns = [
    { key: 'user',    label: 'User', render: r => (
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-full bg-red-50 border border-red-200 text-red-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
          {r.name ? initials(r.name) : <UserCircle2 size={14} />}
        </div>
        <div>
          <p className="font-semibold text-slate-800">{r.name}</p>
          <p className="text-xs text-slate-400">{r.email}</p>
        </div>
      </div>
    )},
    { key: 'role',    label: 'Role',    width: 130, render: r => ROLE_BADGE[r.role] ?? <span className="badge-muted">{r.role}</span> },
    { key: 'company', label: 'Company', render: r => <span className="text-slate-500 text-sm">{r.Company?.name ?? '—'}</span> },
    { key: 'created', label: 'Created', render: r => <span className="text-xs text-slate-400">{new Date(r.createdAt).toLocaleDateString()}</span> },
    { key: 'actions', label: '', width: 80, render: r => (
      <div className="flex gap-1">
        <button onClick={() => openEdit(r)} className="btn-edit"><Pencil size={13} /></button>
        <button onClick={() => setModal({ mode: 'delete', data: r })} className="p-1.5 rounded text-slate-400 hover:text-danger hover:bg-danger-light transition-colors"><Trash2 size={13} /></button>
      </div>
    )},
  ]

  return (
    <div className="px-6 py-6">
      <PageHeader title="Users" subtitle={`${data?.pagination?.total ?? 0} total users`}
        action={<button onClick={() => { setForm(EMPTY); setModal({ mode: 'create' }) }} className="btn-primary"><Plus size={14} />Add User</button>}
      />

      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
          <SearchBar value={search} onChange={v => { setSearch(v); setPage(1) }} placeholder="Search users…" />
        </div>
        <Table columns={columns} data={data?.data} loading={isLoading} emptyText="No users found" />
        <Pagination pagination={data?.pagination} onPageChange={setPage} />
      </div>

      <Modal open={['create','edit'].includes(modal?.mode)} onClose={() => setModal(null)}
        title={modal?.mode === 'edit' ? 'Edit User' : 'New User'} size="md">
        <form onSubmit={e => { e.preventDefault(); save.mutate(form) }} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="label">Full Name</label>
              <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required autoFocus placeholder="John Doe" />
            </div>
            <div className="col-span-2">
              <label className="label">Email</label>
              <input className="input" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required placeholder="john@example.com" />
            </div>
            <div>
              <label className="label">Password {modal?.data && <span className="text-slate-400 font-normal">(leave blank to keep)</span>}</label>
              <input className="input" type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="••••••••" {...(!modal?.data && { required: true })} />
            </div>
            <div>
              <label className="label">Role</label>
              <select className="select" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                {ROLES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-2 pt-2 border-t border-slate-100">
            <button type="button" onClick={() => setModal(null)} className="btn-secondary flex-1 justify-center">Cancel</button>
            <button type="submit" disabled={save.isPending} className="btn-primary flex-1 justify-center">{save.isPending ? 'Saving…' : 'Save User'}</button>
          </div>
        </form>
      </Modal>

      <Modal open={modal?.mode === 'delete'} onClose={() => setModal(null)} title="Delete User" size="sm">
        <p className="text-sm text-slate-600 mb-2">Delete <span className="font-semibold text-slate-800">"{modal?.data?.name}"</span>?</p>
        <p className="text-xs text-danger font-semibold mb-5">This action cannot be undone.</p>
        <div className="flex gap-2">
          <button onClick={() => setModal(null)} className="btn-secondary flex-1 justify-center">Cancel</button>
          <button onClick={() => del.mutate(modal.data.id)} disabled={del.isPending} className="btn-danger flex-1 justify-center">{del.isPending ? 'Deleting…' : 'Delete'}</button>
        </div>
      </Modal>
    </div>
  )
}
