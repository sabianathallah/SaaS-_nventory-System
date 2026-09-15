import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { usersApi, companiesApi, rolesApi, tasksApi } from '../api'
import SearchableSelect from '../components/SearchableSelect'
import DivisiMultiSelect from '../components/DivisiMultiSelect'
import { useAuth } from '../context/AuthContext'
import { useSelectedCompany } from '../context/SelectedCompanyContext'
import PageHeader from '../components/PageHeader'
import { Table, Pagination } from '../components/Table'
import Modal from '../components/Modal'
import SearchBar from '../components/SearchBar'
import toast from 'react-hot-toast'
import { Plus, Pencil, Trash2, UserCircle2, Eye, EyeOff } from 'lucide-react'
import { SYSTEM_ROLE_STYLE, COLOR_PALETTE, roleColorIndex } from './adminShared'

function RoleBadge({ name, displayName }) {
  const style = SYSTEM_ROLE_STYLE[name]
  if (style) return <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wide ${style}`}>{displayName}</span>
  const color = COLOR_PALETTE[roleColorIndex(name)]
  return (
    <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wide"
      style={{ background: color + '20', color }}>
      {displayName}
    </span>
  )
}

export default function Users() {
  const { isSuperAdmin, user } = useAuth()
  const { selectedCompany } = useSelectedCompany()
  const qc = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const page  = Number(searchParams.get('page')  || '1')
  const limit = Number(searchParams.get('limit') || '10')
  const setPage = (p) => setSearchParams(prev => { prev.set('page', String(p)); return prev }, { replace: true })
  const [search, setSearch] = useState('')
  const [modal, setModal]   = useState(null)
  const [showPwd, setShowPwd] = useState(false)

  const companyId = isSuperAdmin ? (selectedCompany?.id ?? null) : user?.companyId
  const { data: roles = [] } = useQuery({
    queryKey: ['roles', companyId],
    queryFn:  () => rolesApi.getAll(companyId ? { companyId } : {}),
  })

  const defaultRole = roles.find(r => r.name !== 'SUPER_ADMIN')?.name ?? ''
  const [form, setForm] = useState({ name: '', email: '', password: '', role: defaultRole, companyId: '', divisis: [], nik: '' })

  const { data, isLoading } = useQuery({
    queryKey: ['users', { page, limit, name: search }],
    queryFn:  () => usersApi.list({ page, limit, name: search }),
  })

  const { data: companiesData } = useQuery({
    queryKey: ['companies-all'],
    queryFn:  () => companiesApi.list({ limit: 200 }),
    enabled:  isSuperAdmin,
  })
  const companies = companiesData?.data ?? []

  // Dropdown-only divisi picker (no free-text typos) — sourced from every
  // divisi already in use (incl. standing folders like Umum/HR), so admins
  // pick from a real list instead of retyping department names by hand.
  const { data: divisionsData } = useQuery({
    queryKey: ['task-divisions'],
    queryFn:  tasksApi.listDivisions,
  })
  const divisionOptions = (divisionsData ?? []).map(d => d.divisi).sort((a, b) => a.localeCompare(b))

  const save = useMutation({
    mutationFn: d => {
      const payload = { ...d }
      if (!payload.password) delete payload.password
      if (!payload.companyId) delete payload.companyId
      return modal?.data ? usersApi.update(modal.data.id, payload) : usersApi.create(payload)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
      qc.invalidateQueries({ queryKey: ['task-divisions'] })
      toast.success(modal?.data ? 'User diperbarui' : 'User dibuat')
      setModal(null)
    },
    onError: e => toast.error(e.response?.data?.message || 'Error'),
  })

  const del = useMutation({
    mutationFn: id => usersApi.remove(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); toast.success('User dihapus'); setModal(null) },
    onError: e => toast.error(e.response?.data?.message || 'Error'),
  })

  const openEdit   = (r) => { setForm({ name: r.name, email: r.email, password: '', role: r.role, companyId: r.companyId ?? '', divisis: r.divisis?.length ? r.divisis : (r.divisi ? [r.divisi] : []), nik: r.nik ?? '' }); setModal({ mode: 'edit', data: r }) }
  const openCreate = ()  => { setForm({ name: '', email: '', password: '', role: defaultRole, companyId: '', divisis: [], nik: '' }); setModal({ mode: 'create' }) }
  const set = f => e => setForm(v => ({ ...v, [f]: e.target.value }))
  const initials = (name = '') => name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()

  const assignableRoles = roles.filter(r => r.name !== 'SUPER_ADMIN')
  const roleMap = Object.fromEntries(roles.map(r => [r.name, r]))

  const columns = [
    {
      key: 'user', label: 'User',
      render: r => (
        <div className="flex items-center gap-2.5">
          {r.avatar
            ? <img src={r.avatar} alt={r.name} className="w-8 h-8 rounded-full object-cover flex-shrink-0 border border-slate-200" />
            : <div className="w-8 h-8 rounded-full bg-red-50 border border-red-200 text-red-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                {r.name ? initials(r.name) : <UserCircle2 size={14} />}
              </div>
          }
          <div>
            <p className="font-semibold text-slate-800">{r.name}</p>
            <p className="text-xs text-slate-400">{r.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'role', label: 'Role', width: 160,
      render: r => {
        const rd = roleMap[r.role]
        return (
          <div>
            <RoleBadge name={r.role} displayName={rd?.displayName ?? r.roleDisplayName ?? r.role} />
            {(r.divisis?.length ? r.divisis : (r.divisi ? [r.divisi] : [])).length > 0 && (
              <div className="text-[10px] text-slate-400 mt-0.5">
                {(r.divisis?.length ? r.divisis : [r.divisi]).join(', ')}
              </div>
            )}
          </div>
        )
      },
    },
    {
      key: 'company', label: 'Company',
      render: r => <span className="text-slate-500 text-sm">{r.company?.name ?? '—'}</span>,
    },
    {
      key: 'status', label: 'Status', width: 90,
      render: r => r.isActive
        ? <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-green-50 text-green-700">Aktif</span>
        : <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-500">Nonaktif</span>,
    },
    {
      key: 'actions', label: '', width: 80,
      render: r => (
        <div className="flex gap-1">
          <button onClick={() => openEdit(r)} className="btn-edit"><Pencil size={13} /></button>
          <button onClick={() => setModal({ mode: 'delete', data: r })} className="p-1.5 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors">
            <Trash2 size={13} />
          </button>
        </div>
      ),
    },
  ]

  return (
    <div className="px-6 py-6 space-y-5">
      <PageHeader title="Pengguna" subtitle="Kelola daftar pengguna dan role yang ditugaskan — atur permission tiap role di halaman Roles & Permission" />

      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between gap-3">
          <SearchBar value={search} onChange={v => { setSearch(v); setPage(1) }} placeholder="Cari nama user…" />
          <button onClick={openCreate} className="btn-primary flex-shrink-0"><Plus size={14} /> Tambah User</button>
        </div>
        <Table columns={columns} data={data?.data} loading={isLoading} emptyText="Belum ada user" />
        <Pagination pagination={data?.pagination} onPageChange={setPage} />
      </div>

      <Modal open={['create', 'edit'].includes(modal?.mode)} onClose={() => setModal(null)}
        title={modal?.mode === 'edit' ? 'Edit User' : 'Tambah User'} size="md">
        <form onSubmit={e => { e.preventDefault(); save.mutate(form) }} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="label">Nama Lengkap <span className="text-danger">*</span></label>
              <input className="input" value={form.name} onChange={set('name')} required placeholder="Nama lengkap…" />
            </div>
            <div className="col-span-2">
              <label className="label">Email <span className="text-danger">*</span></label>
              <input className="input" type="email" value={form.email} onChange={set('email')} required placeholder="email@domain.com" />
            </div>
            <div>
              <label className="label">
                Password {modal?.mode === 'edit' && <span className="text-slate-400 font-normal text-xs">(kosongkan = tidak berubah)</span>}
              </label>
              <div className="relative">
                <input className="input pr-10" type={showPwd ? 'text' : 'password'} value={form.password} onChange={set('password')}
                  placeholder="••••••••" {...(modal?.mode === 'create' && { required: true })} />
                <button type="button" onClick={() => setShowPwd(v => !v)} tabIndex={-1}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                  {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
            <div>
              <label className="label">Role <span className="text-danger">*</span></label>
              <SearchableSelect
                value={form.role}
                onChange={v => setForm(f => ({ ...f, role: v }))}
                options={assignableRoles.map(r => ({ value: r.name, label: r.displayName }))}
                placeholder="Pilih role…"
                required
              />
            </div>
            <div className="col-span-2">
              <label className="label">Divisi <span className="text-slate-400 font-normal text-xs">(bisa lebih dari satu)</span></label>
              <DivisiMultiSelect
                value={form.divisis}
                onChange={divisis => setForm(f => ({ ...f, divisis }))}
                options={divisionOptions}
                placeholder="Pilih divisi…"
              />
            </div>
            <div>
              <label className="label">NIK</label>
              <input className="input" value={form.nik} onChange={set('nik')} placeholder="Nomor Induk Kependudukan (opsional)" />
            </div>
            {isSuperAdmin && (
              <div className="col-span-2">
                <label className="label">Company</label>
                <SearchableSelect
                  value={form.companyId}
                  onChange={v => setForm(f => ({ ...f, companyId: v }))}
                  options={[{ value: '', label: '— Tidak ada —' }, ...companies.map(c => ({ value: c.id, label: c.name }))]}
                  placeholder="— Tidak ada —"
                />
              </div>
            )}
            <div className="col-span-2 flex items-center gap-2">
              <input type="checkbox" id="isActive" className="rounded" checked={form.isActive !== false}
                onChange={e => setForm(v => ({ ...v, isActive: e.target.checked }))} />
              <label htmlFor="isActive" className="label mb-0 cursor-pointer">User aktif</label>
            </div>
          </div>
          <div className="flex gap-2 pt-2 border-t border-slate-100">
            <button type="button" onClick={() => setModal(null)} className="btn-secondary flex-1 justify-center">Batal</button>
            <button type="submit" disabled={save.isPending} className="btn-primary flex-1 justify-center">
              {save.isPending ? 'Menyimpan…' : 'Simpan'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={modal?.mode === 'delete'} onClose={() => setModal(null)} title="Hapus User" size="sm">
        <p className="text-sm text-slate-600 mb-2">Hapus user <span className="font-semibold text-slate-800">"{modal?.data?.name}"</span>?</p>
        <p className="text-xs text-red-600 font-semibold mb-5">Tindakan ini tidak bisa dibatalkan.</p>
        <div className="flex gap-2">
          <button onClick={() => setModal(null)} className="btn-secondary flex-1 justify-center">Batal</button>
          <button onClick={() => del.mutate(modal.data.id)} disabled={del.isPending} className="btn-danger flex-1 justify-center">
            {del.isPending ? 'Menghapus…' : 'Hapus'}
          </button>
        </div>
      </Modal>
    </div>
  )
}
