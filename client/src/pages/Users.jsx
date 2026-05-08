import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { usersApi, companiesApi, rolesApi, permissionsApi } from '../api'
import { useAuth } from '../context/AuthContext'
import PageHeader from '../components/PageHeader'
import { Table, Pagination } from '../components/Table'
import Modal from '../components/Modal'
import SearchBar from '../components/SearchBar'
import toast from 'react-hot-toast'
import { Plus, Pencil, Trash2, UserCircle2, ShieldCheck, Save, Check, X, Eye, EyeOff } from 'lucide-react'

// ── Role badge helpers ────────────────────────────────────────────────────────

const SYSTEM_ROLE_STYLE = {
  SUPER_ADMIN:   'bg-red-100 text-red-700',
  ADMIN:         'bg-orange-100 text-orange-700',
  COMPANY_ADMIN: 'bg-blue-100 text-blue-700',
  OPERASIONAL:   'bg-teal-100 text-teal-700',
  TIM_PACKING:   'bg-violet-100 text-violet-700',
}

const COLOR_PALETTE = ['#F97316','#10B981','#06B6D4','#8B5CF6','#EF4444','#F59E0B','#6366F1','#14B8A6','#84CC16','#EC4899']

function roleColorIndex(name) {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xFFFFFF
  return h % COLOR_PALETTE.length
}

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

function roleColor(name) {
  const PRESET = { SUPER_ADMIN:'#EF4444', ADMIN:'#F97316', COMPANY_ADMIN:'#3B82F6', OPERASIONAL:'#14B8A6', TIM_PACKING:'#8B5CF6' }
  return PRESET[name] ?? COLOR_PALETTE[roleColorIndex(name)]
}

// ── Toggle ────────────────────────────────────────────────────────────────────

function Toggle({ checked, onChange }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={onChange}
      className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none ${checked ? 'bg-green-500' : 'bg-slate-300'}`}>
      <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transform transition-transform duration-200 ${checked ? 'translate-x-[18px]' : 'translate-x-[3px]'}`} />
    </button>
  )
}

// ── Users Tab ─────────────────────────────────────────────────────────────────

function UsersTab({ isSuperAdmin, roles }) {
  const qc = useQueryClient()
  const [page, setPage]     = useState(1)
  const [search, setSearch] = useState('')
  const [modal, setModal]   = useState(null)
  const [showPwd, setShowPwd] = useState(false)

  const defaultRole = roles.find(r => r.name !== 'SUPER_ADMIN')?.name ?? ''
  const [form, setForm] = useState({ name: '', email: '', password: '', role: defaultRole, companyId: '' })

  const { data, isLoading } = useQuery({
    queryKey: ['users', { page, name: search }],
    queryFn:  () => usersApi.list({ page, limit: 10, name: search }),
  })

  const { data: companiesData } = useQuery({
    queryKey: ['companies-all'],
    queryFn:  () => companiesApi.list({ limit: 200 }),
    enabled:  isSuperAdmin,
  })
  const companies = companiesData?.data ?? []

  const save = useMutation({
    mutationFn: d => {
      const payload = { ...d }
      if (!payload.password) delete payload.password
      if (!payload.companyId) delete payload.companyId
      return modal?.data ? usersApi.update(modal.data.id, payload) : usersApi.create(payload)
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); toast.success(modal?.data ? 'User diperbarui' : 'User dibuat'); setModal(null) },
    onError: e => toast.error(e.response?.data?.message || 'Error'),
  })

  const del = useMutation({
    mutationFn: id => usersApi.remove(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); toast.success('User dihapus'); setModal(null) },
    onError: e => toast.error(e.response?.data?.message || 'Error'),
  })

  const openEdit   = (r) => { setForm({ name: r.name, email: r.email, password: '', role: r.role, companyId: r.companyId ?? '' }); setModal({ mode: 'edit', data: r }) }
  const openCreate = ()  => { setForm({ name: '', email: '', password: '', role: defaultRole, companyId: '' }); setModal({ mode: 'create' }) }
  const set = f => e => setForm(v => ({ ...v, [f]: e.target.value }))
  const initials = (name = '') => name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()

  const assignableRoles = roles.filter(r => r.name !== 'SUPER_ADMIN')
  const roleMap = Object.fromEntries(roles.map(r => [r.name, r]))

  const columns = [
    {
      key: 'user', label: 'User',
      render: r => (
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-red-50 border border-red-200 text-red-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
            {r.name ? initials(r.name) : <UserCircle2 size={14} />}
          </div>
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
        return <RoleBadge name={r.role} displayName={rd?.displayName ?? r.role} />
      },
    },
    {
      key: 'company', label: 'Company',
      render: r => <span className="text-slate-500 text-sm">{r.Company?.name ?? r.company?.name ?? '—'}</span>,
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
    <>
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
              <select className="select" value={form.role} onChange={set('role')}>
                {assignableRoles.map(r => (
                  <option key={r.id} value={r.name}>{r.displayName}</option>
                ))}
              </select>
            </div>
            {isSuperAdmin && (
              <div className="col-span-2">
                <label className="label">Company</label>
                <select className="select" value={form.companyId} onChange={set('companyId')}>
                  <option value="">— Tidak ada —</option>
                  {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
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
    </>
  )
}

// ── Roles Tab ─────────────────────────────────────────────────────────────────

function RolesTab({ roles, allPermissions, onRolesChange }) {
  const qc = useQueryClient()

  const [selectedId, setSelectedId] = useState(roles[0]?.id ?? null)
  const [dirty, setDirty]           = useState({})
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName]       = useState('')
  const [newDisplay, setNewDisplay] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(null)

  const selectedRole = roles.find(r => r.id === selectedId) ?? roles[0]

  const updateMut = useMutation({
    mutationFn: ({ id, displayName, permissions }) => rolesApi.update(id, displayName, permissions),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['roles'] })
      setDirty(d => { const n = { ...d }; delete n[id]; return n })
      toast.success('Permission disimpan')
      onRolesChange()
    },
    onError: e => toast.error(e.response?.data?.message || 'Error'),
  })

  const deleteMut = useMutation({
    mutationFn: (id) => rolesApi.destroy(id),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ['roles'] })
      setDirty(d => { const n = { ...d }; delete n[id]; return n })
      setConfirmDelete(null)
      toast.success('Role dihapus')
      if (selectedId === id) setSelectedId(roles.find(r => r.id !== id)?.id ?? null)
      onRolesChange()
    },
    onError: e => toast.error(e.response?.data?.message || 'Error'),
  })

  const createMut = useMutation({
    mutationFn: () => rolesApi.create(newName.trim(), newDisplay.trim() || newName.trim()),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['roles'] })
      toast.success(`Role "${res.displayName}" dibuat`)
      setNewName(''); setNewDisplay(''); setShowCreate(false)
      setSelectedId(res.id)
      onRolesChange()
    },
    onError: e => toast.error(e.response?.data?.message || 'Error'),
  })

  const groups = [...new Set(allPermissions.map(p => p.group))]

  const getPerms    = (id) => dirty[id] ?? roles.find(r => r.id === id)?.permissions ?? []
  const isDirty     = (id) => !!dirty[id]
  const activePerms = selectedRole ? getPerms(selectedRole.id) : []
  const activeColor = selectedRole ? roleColor(selectedRole.name) : '#94A3B8'

  const togglePerm = (id, key) => {
    const cur  = getPerms(id)
    const next = cur.includes(key) ? cur.filter(k => k !== key) : [...cur, key]
    setDirty(d => ({ ...d, [id]: next }))
  }

  return (
    <div className="flex gap-0 rounded-2xl overflow-hidden border border-slate-200 shadow-sm" style={{ minHeight: 520 }}>

      {/* ── Left: role list ───────────────────────────────────────────────── */}
      <div className="w-56 flex-shrink-0 bg-slate-50 border-r border-slate-200 flex flex-col">
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Roles</p>
          <button onClick={() => { setShowCreate(v => !v); setNewName(''); setNewDisplay('') }}
            className="text-[10px] font-semibold text-slate-400 hover:text-slate-700 transition-colors flex items-center gap-1"
            title="Buat role baru">
            <Plus size={11} /> Baru
          </button>
        </div>

        {showCreate && (
          <form onSubmit={e => { e.preventDefault(); if (newName.trim()) createMut.mutate() }}
            className="px-3 py-2.5 border-b border-slate-200 bg-white space-y-2">
            <div>
              <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1 block">Nama Role (key)</label>
              <input autoFocus className="input text-xs py-1.5" placeholder="cth: MARKETING" value={newName}
                onChange={e => setNewName(e.target.value.toUpperCase().replace(/\s+/g, '_'))} maxLength={40} />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1 block">Label Tampilan</label>
              <input className="input text-xs py-1.5" placeholder="cth: Marketing" value={newDisplay}
                onChange={e => setNewDisplay(e.target.value)} maxLength={60} />
            </div>
            <div className="flex gap-1.5 pt-1">
              <button type="submit" disabled={!newName.trim() || createMut.isPending}
                className="flex-1 text-[11px] font-semibold py-1.5 rounded-lg bg-slate-800 text-white disabled:opacity-40 hover:bg-slate-700 transition-colors">
                {createMut.isPending ? '…' : 'Buat Role'}
              </button>
              <button type="button" onClick={() => setShowCreate(false)}
                className="px-2 text-[11px] font-semibold rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 transition-colors">
                Batal
              </button>
            </div>
          </form>
        )}

        <nav className="flex-1 overflow-y-auto py-2">
          {roles.map(role => {
            const color  = roleColor(role.name)
            const active = role.id === selectedRole?.id
            const hasDirt = isDirty(role.id)
            return (
              <div key={role.id}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm font-medium transition-all text-left group relative ${
                  active ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:bg-white/60 hover:text-slate-800'
                }`}>
                {active && <span className="absolute left-0 top-1 bottom-1 w-0.5 rounded-r" style={{ background: color }} />}
                <button onClick={() => setSelectedId(role.id)} className="flex items-center gap-2.5 flex-1 min-w-0 text-left">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: color, opacity: active ? 1 : 0.6 }} />
                  <span className="flex-1 truncate">{role.displayName}</span>
                  {!role.isSystem && !hasDirt && <span className="text-[9px] text-slate-400 font-medium shrink-0">kustom</span>}
                  {hasDirt && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" title="Belum disimpan" />}
                </button>
                {!role.isSystem && (
                  <button onClick={e => { e.stopPropagation(); setConfirmDelete(role) }}
                    className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all flex-shrink-0"
                    title="Hapus role">
                    <Trash2 size={11} />
                  </button>
                )}
              </div>
            )
          })}
        </nav>

        <div className="px-3 py-3 border-t border-slate-200">
          <p className="text-[10px] text-slate-400 leading-relaxed">
            <strong className="text-slate-500">SUPER_ADMIN</strong> & <strong className="text-slate-500">ADMIN</strong> mendapat akses penuh dan tidak bisa diedit.
          </p>
        </div>
      </div>

      {/* ── Right: permission editor ──────────────────────────────────────── */}
      {selectedRole ? (
        <div className="flex-1 flex flex-col bg-white">
          <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-200">
            <span className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center" style={{ background: activeColor + '20' }}>
              <ShieldCheck size={15} style={{ color: activeColor }} />
            </span>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-slate-900 leading-tight">{selectedRole.displayName}</p>
              <p className="text-xs text-slate-400">{activePerms.length} permission aktif</p>
            </div>
            {isDirty(selectedRole.id) && (
              <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-amber-100 text-amber-700">Belum disimpan</span>
            )}
            {!selectedRole.isSystem && (
              <button onClick={() => setConfirmDelete(selectedRole)}
                className="flex items-center gap-1.5 text-xs font-medium text-red-500 hover:text-red-700 px-2.5 py-1.5 rounded-lg hover:bg-red-50 transition-colors">
                <Trash2 size={12} /> Hapus Role
              </button>
            )}
          </div>

          {confirmDelete && (
            <div className="mx-6 mt-4 p-4 rounded-xl border border-red-200 bg-red-50/50 flex items-center gap-4">
              <div className="flex-1 text-sm">
                <p className="font-semibold text-slate-800">Hapus role "<span className="text-red-700">{confirmDelete.displayName}</span>"?</p>
                <p className="text-xs text-slate-500 mt-0.5">User dengan role ini tidak akan bisa login. Pastikan sudah dipindah dulu.</p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button onClick={() => setConfirmDelete(null)} className="btn-secondary text-xs px-3">Batal</button>
                <button onClick={() => deleteMut.mutate(confirmDelete.id)} disabled={deleteMut.isPending} className="btn-danger text-xs px-3">
                  {deleteMut.isPending ? '…' : 'Hapus'}
                </button>
              </div>
            </div>
          )}

          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
            {selectedRole.isSystem ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <ShieldCheck size={32} className="text-slate-200 mb-3" />
                <p className="text-sm font-semibold text-slate-500">Role Sistem</p>
                <p className="text-xs text-slate-400 mt-1">Role ini memiliki akses penuh dan tidak bisa diedit.</p>
              </div>
            ) : (
              groups.map(group => {
                const groupPerms = allPermissions.filter(p => p.group === group)
                const allOn = groupPerms.every(p => activePerms.includes(p.key))
                return (
                  <div key={group}>
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">{group}</p>
                      <button onClick={() => {
                        const keys = groupPerms.map(p => p.key)
                        const cur  = getPerms(selectedRole.id)
                        const next = allOn ? cur.filter(k => !keys.includes(k)) : [...new Set([...cur, ...keys])]
                        setDirty(d => ({ ...d, [selectedRole.id]: next }))
                      }} className="text-[10px] font-semibold text-slate-400 hover:text-slate-600 transition-colors">
                        {allOn ? 'Nonaktifkan semua' : 'Aktifkan semua'}
                      </button>
                    </div>
                    <div className="space-y-0 rounded-xl overflow-hidden border border-slate-100">
                      {groupPerms.map((perm, idx) => {
                        const checked = activePerms.includes(perm.key)
                        return (
                          <div key={perm.key}
                            className={`flex items-center gap-4 px-4 py-3.5 bg-white hover:bg-slate-50/60 transition-colors cursor-pointer ${idx < groupPerms.length - 1 ? 'border-b border-slate-100' : ''}`}
                            onClick={() => togglePerm(selectedRole.id, perm.key)}>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-slate-800 leading-tight">{perm.label}</p>
                            </div>
                            <div className="flex items-center gap-2.5 flex-shrink-0" onClick={e => e.stopPropagation()}>
                              {checked ? <Check size={12} className="text-green-500" /> : <X size={12} className="text-slate-300" />}
                              <Toggle checked={checked} onChange={() => togglePerm(selectedRole.id, perm.key)} />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {!selectedRole.isSystem && (
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50/50">
              {isDirty(selectedRole.id) && (
                <button onClick={() => setDirty(d => { const n = { ...d }; delete n[selectedRole.id]; return n })}
                  className="text-xs font-medium text-slate-500 hover:text-slate-700 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors">
                  Batalkan
                </button>
              )}
              <button onClick={() => updateMut.mutate({ id: selectedRole.id, displayName: selectedRole.displayName, permissions: getPerms(selectedRole.id) })}
                disabled={!isDirty(selectedRole.id) || updateMut.isPending}
                className="flex items-center gap-1.5 text-sm font-semibold px-4 py-1.5 rounded-lg text-white transition-all disabled:opacity-40"
                style={{ background: isDirty(selectedRole.id) ? activeColor : '#94A3B8' }}>
                <Save size={13} />
                {updateMut.isPending ? 'Menyimpan…' : 'Simpan Perubahan'}
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-sm text-slate-300">Pilih role di kiri</div>
      )}
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function Users() {
  const { isSuperAdmin, user } = useAuth()
  const [tab, setTab] = useState('users')
  const qc = useQueryClient()

  const companyId = isSuperAdmin ? null : user?.companyId

  const { data: roles = [], refetch: refetchRoles } = useQuery({
    queryKey: ['roles', companyId],
    queryFn:  () => rolesApi.getAll(companyId ? { companyId } : {}),
  })

  const { data: allPermissions = [] } = useQuery({
    queryKey: ['permissions'],
    queryFn:  permissionsApi.getAll,
    staleTime: Infinity,
  })

  const handleRolesChange = () => {
    refetchRoles()
    qc.invalidateQueries({ queryKey: ['roles'] })
  }

  return (
    <div className="px-6 py-6 space-y-5">
      <PageHeader title="Administrasi Users" subtitle="Kelola user dan hak akses per role" />

      <div className="flex gap-1 p-1 bg-slate-100 rounded-xl w-fit">
        {[
          { key: 'users', label: 'Daftar User',   icon: UserCircle2 },
          { key: 'roles', label: 'Kelola Role',   icon: ShieldCheck },
        ].map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === key ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'
            }`}>
            <Icon size={14} />{label}
          </button>
        ))}
      </div>

      {tab === 'users' && <UsersTab isSuperAdmin={isSuperAdmin} roles={roles} />}
      {tab === 'roles' && <RolesTab roles={roles} allPermissions={allPermissions} onRolesChange={handleRolesChange} />}
    </div>
  )
}
