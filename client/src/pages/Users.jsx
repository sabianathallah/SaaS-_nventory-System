import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { usersApi, companiesApi, rolePermissionsApi } from '../api'
import { useAuth } from '../context/AuthContext'
import PageHeader from '../components/PageHeader'
import { Table, Pagination } from '../components/Table'
import Modal from '../components/Modal'
import SearchBar from '../components/SearchBar'
import toast from 'react-hot-toast'
import { Plus, Pencil, Trash2, UserCircle2, ShieldCheck, RotateCcw, Save, Check, X } from 'lucide-react'

// ── Constants ─────────────────────────────────────────────────────────────────

const SYSTEM_ROLES    = ['SUPER_ADMIN', 'ADMIN']
const EDITABLE_ROLES  = ['COMPANY_ADMIN', 'OPERASIONAL', 'HEAD_PACKING', 'TIM_PACKING', 'HR', 'CEO']
const ALL_SYSTEM_KEYS = [...SYSTEM_ROLES, ...EDITABLE_ROLES]

const ROLE_BADGE = {
  SUPER_ADMIN:   <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-red-100 text-red-700 uppercase tracking-wide">Super Admin</span>,
  ADMIN:         <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-orange-100 text-orange-700 uppercase tracking-wide">Admin</span>,
  COMPANY_ADMIN: <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-700 uppercase tracking-wide">Company Admin</span>,
  OPERASIONAL:   <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-teal-100 text-teal-700 uppercase tracking-wide">Operasional</span>,
  HEAD_PACKING:  <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-purple-100 text-purple-700 uppercase tracking-wide">Head Packing</span>,
  TIM_PACKING:   <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-violet-100 text-violet-700 uppercase tracking-wide">Tim Packing</span>,
  HR:            <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-pink-100 text-pink-700 uppercase tracking-wide">HR</span>,
  CEO:           <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700 uppercase tracking-wide">CEO</span>,
}

const ROLE_COLORS = {
  COMPANY_ADMIN: '#3B82F6',
  OPERASIONAL:   '#14B8A6',
  HEAD_PACKING:  '#A855F7',
  TIM_PACKING:   '#8B5CF6',
  HR:            '#EC4899',
  CEO:           '#F59E0B',
}

const CUSTOM_COLOR_PALETTE = ['#F97316', '#10B981', '#06B6D4', '#EF4444', '#84CC16', '#F59E0B', '#6366F1']

function roleLabel(key) {
  const labels = {
    SUPER_ADMIN: 'Super Admin', ADMIN: 'Admin', COMPANY_ADMIN: 'Company Admin',
    OPERASIONAL: 'Operasional', HEAD_PACKING: 'Head Packing', TIM_PACKING: 'Tim Packing',
    HR: 'HR', CEO: 'CEO',
  }
  return labels[key] ?? key.split('_').map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(' ')
}

function roleColor(key, customRoles) {
  if (ROLE_COLORS[key]) return ROLE_COLORS[key]
  const idx = customRoles.findIndex(r => r.key === key)
  return CUSTOM_COLOR_PALETTE[idx % CUSTOM_COLOR_PALETTE.length] ?? '#64748B'
}

const PERM_DESCRIPTIONS = {
  'inventory.view':          'Dapat melihat daftar produk, katalog, dan informasi warehouse',
  'inventory.manage':        'Dapat menambah, mengubah, dan menghapus produk serta konfigurasi warehouse',
  'stock.view':              'Dapat melihat level stok saat ini dan riwayat pergerakan stok',
  'stock.manage':            'Dapat melakukan stock in, stock out, dan stock opname',
  'stock.in.scan':           'Stock In: menambah item hanya via scan barcode/QR',
  'stock.in.manual_input':   'Stock In: input produk secara manual tanpa scan (dropdown + qty)',
  'stock.in.delete_item':    'Stock In: menghapus item yang sudah tersimpan di transaksi',
  'stock.out.scan':          'Stock Out: menambah item hanya via scan barcode/QR',
  'stock.out.manual_input':  'Stock Out: input produk secara manual tanpa scan (dropdown + qty)',
  'stock.opname.scan':       'Stock Opname: hitung produk hanya via scan barcode/QR',
  'stock.opname.manual_input':'Stock Opname: input kuantitas produk secara manual tanpa scan',
  'packing.view':            'Dapat mengakses dan melihat semua halaman modul packing',
  'packing.incoming':        'Dapat membuat dan mengelola dokumen barang masuk serta surat jalan',
  'packing.jobs':            'Dapat membuat packing job dan mengassign ke tim packing',
  'packing.verify':          'Dapat memverifikasi hasil packing dan membuat Form Anak Packing (FAP)',
  'reports.dashboard':       'Dapat melihat dashboard statistik dan laporan inventory',
  'admin.users':             'Dapat mengelola akun user (tambah, edit, nonaktifkan)',
}

// ── Toggle ────────────────────────────────────────────────────────────────────

function Toggle({ checked, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none ${
        checked ? 'bg-green-500' : 'bg-slate-300'
      }`}
    >
      <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transform transition-transform duration-200 ${
        checked ? 'translate-x-[18px]' : 'translate-x-[3px]'
      }`} />
    </button>
  )
}

// ── Users Tab ─────────────────────────────────────────────────────────────────

function UsersTab({ isSuperAdmin, allRoles }) {
  const qc = useQueryClient()
  const [page, setPage]     = useState(1)
  const [search, setSearch] = useState('')
  const [modal, setModal]   = useState(null)
  const [form, setForm]     = useState({ name: '', email: '', password: '', role: 'OPERASIONAL', companyId: '' })

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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
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

  const openEdit   = (r) => { setForm({ name: r.name, email: r.email, password: '', role: r.role, companyId: r.companyId ?? '' }); setModal({ mode: 'edit', data: r }) }
  const openCreate = ()  => { setForm({ name: '', email: '', password: '', role: 'OPERASIONAL', companyId: '' }); setModal({ mode: 'create' }) }
  const set = f => e => setForm(v => ({ ...v, [f]: e.target.value }))
  const initials = (name = '') => name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()

  // All assignable roles (exclude SUPER_ADMIN)
  const assignableRoles = allRoles.filter(r => r !== 'SUPER_ADMIN')

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
      render: r => ROLE_BADGE[r.role] ?? <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700 uppercase tracking-wide">{roleLabel(r.role)}</span>,
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
          <button onClick={() => setModal({ mode: 'delete', data: r })}
            className="p-1.5 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors">
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
          <button onClick={openCreate} className="btn-primary flex-shrink-0">
            <Plus size={14} /> Tambah User
          </button>
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
              <input className="input" type="password" value={form.password} onChange={set('password')}
                placeholder="••••••••" {...(modal?.mode === 'create' && { required: true })} />
            </div>
            <div>
              <label className="label">Role <span className="text-danger">*</span></label>
              <select className="select" value={form.role} onChange={set('role')}>
                {assignableRoles.map(r => (
                  <option key={r} value={r}>{roleLabel(r)}</option>
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
              <input type="checkbox" id="isActive" className="rounded"
                checked={form.isActive !== false}
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
        <p className="text-sm text-slate-600 mb-2">
          Hapus user <span className="font-semibold text-slate-800">"{modal?.data?.name}"</span>?
        </p>
        <p className="text-xs text-red-600 font-semibold mb-5">Tindakan ini tidak bisa dibatalkan.</p>
        <div className="flex gap-2">
          <button onClick={() => setModal(null)} className="btn-secondary flex-1 justify-center">Batal</button>
          <button onClick={() => del.mutate(modal.data.id)} disabled={del.isPending}
            className="btn-danger flex-1 justify-center">
            {del.isPending ? 'Menghapus…' : 'Hapus'}
          </button>
        </div>
      </Modal>
    </>
  )
}

// ── Permissions Tab ────────────────────────────────────────────────────────────

function PermissionsTab({ companyId }) {
  const qc = useQueryClient()
  const [selectedRole, setSelectedRole] = useState(EDITABLE_ROLES[0])
  const [dirty, setDirty]               = useState({})
  const [showCreate, setShowCreate]     = useState(false)
  const [newRoleName, setNewRoleName]   = useState('')
  const [confirmDelete, setConfirmDelete] = useState(null)

  const { data, isLoading } = useQuery({
    queryKey: ['role-permissions', companyId],
    queryFn:  () => rolePermissionsApi.getAll(companyId ? { companyId } : {}),
  })

  const updateMut = useMutation({
    mutationFn: ({ role, permissions }) => rolePermissionsApi.update(role, permissions),
    onSuccess: (_, { role }) => {
      qc.invalidateQueries({ queryKey: ['role-permissions'] })
      setDirty(d => { const n = { ...d }; delete n[role]; return n })
      toast.success(`Permission ${roleLabel(role)} disimpan`)
    },
    onError: e => toast.error(e.response?.data?.message || 'Error'),
  })

  const deleteMut = useMutation({
    mutationFn: (role) => rolePermissionsApi.deleteRole(role),
    onSuccess: (res, role) => {
      qc.invalidateQueries({ queryKey: ['role-permissions'] })
      setDirty(d => { const n = { ...d }; delete n[role]; return n })
      setConfirmDelete(null)
      if (res.deleted) {
        toast.success(`Role "${roleLabel(role)}" dihapus`)
        setSelectedRole(EDITABLE_ROLES[0])
      } else {
        toast.success(`Permission ${roleLabel(role)} direset ke default`)
      }
    },
    onError: e => toast.error(e.response?.data?.message || 'Error'),
  })

  const createMut = useMutation({
    mutationFn: (name) => rolePermissionsApi.createRole(name, []),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['role-permissions'] })
      toast.success(`Role "${roleLabel(res.role)}" dibuat`)
      setNewRoleName('')
      setShowCreate(false)
      setSelectedRole(res.role)
    },
    onError: e => toast.error(e.response?.data?.message || 'Error'),
  })

  if (isLoading) {
    return <div className="flex items-center justify-center py-20 text-sm text-slate-400">Memuat pengaturan role…</div>
  }

  const allPermissions = data?.allPermissions ?? []
  const serverPerms    = data?.permissions ?? {}
  const serverRoles    = data?.roles ?? EDITABLE_ROLES.map(key => ({ key, isCustom: false }))
  const customRoles    = serverRoles.filter(r => r.isCustom)
  const groups         = [...new Set(allPermissions.map(p => p.group))]

  const getPerms    = (role) => dirty[role] ?? serverPerms[role] ?? []
  const isDirty     = (role) => !!dirty[role]
  const activeColor = roleColor(selectedRole, customRoles)

  const togglePerm = (role, key) => {
    const cur  = getPerms(role)
    const next = cur.includes(key) ? cur.filter(k => k !== key) : [...cur, key]
    setDirty(d => ({ ...d, [role]: next }))
  }

  const handleSave    = () => updateMut.mutate({ role: selectedRole, permissions: getPerms(selectedRole) })
  const handleDiscard = () => setDirty(d => { const n = { ...d }; delete n[selectedRole]; return n })

  const activePerms = getPerms(selectedRole)
  const activeCount = activePerms.length
  const isCustomSelected = serverRoles.find(r => r.key === selectedRole)?.isCustom ?? false

  return (
    <div className="flex gap-0 rounded-2xl overflow-hidden border border-slate-200 shadow-sm" style={{ minHeight: 520 }}>

      {/* ── Left: Role list ─────────────────────────────────────────────── */}
      <div className="w-52 flex-shrink-0 bg-slate-50 border-r border-slate-200 flex flex-col">
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Roles</p>
          <button
            onClick={() => { setShowCreate(v => !v); setNewRoleName('') }}
            className="text-[10px] font-semibold text-slate-400 hover:text-slate-700 transition-colors flex items-center gap-1"
            title="Tambah role baru"
          >
            <Plus size={11} /> Baru
          </button>
        </div>

        {/* Create role inline form */}
        {showCreate && (
          <form
            onSubmit={e => { e.preventDefault(); if (newRoleName.trim()) createMut.mutate(newRoleName.trim()) }}
            className="px-3 py-2.5 border-b border-slate-200 bg-white"
          >
            <input
              autoFocus
              className="input text-xs py-1.5 mb-2"
              placeholder="Nama role baru…"
              value={newRoleName}
              onChange={e => setNewRoleName(e.target.value)}
              maxLength={40}
            />
            <div className="flex gap-1.5">
              <button type="submit" disabled={!newRoleName.trim() || createMut.isPending}
                className="flex-1 text-[11px] font-semibold py-1 rounded-lg bg-slate-800 text-white disabled:opacity-40 hover:bg-slate-700 transition-colors">
                {createMut.isPending ? '…' : 'Buat'}
              </button>
              <button type="button" onClick={() => setShowCreate(false)}
                className="px-2 text-[11px] font-semibold rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 transition-colors">
                Batal
              </button>
            </div>
            <p className="text-[10px] text-slate-400 mt-1.5">
              Spasi → underscore, auto uppercase.
            </p>
          </form>
        )}

        <nav className="flex-1 overflow-y-auto py-2">
          {serverRoles.map(({ key: role, isCustom }) => {
            const color   = roleColor(role, customRoles)
            const active  = role === selectedRole
            const hasDirt = isDirty(role)
            return (
              <button
                key={role}
                onClick={() => setSelectedRole(role)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm font-medium transition-all text-left group relative ${
                  active
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:bg-white/60 hover:text-slate-800'
                }`}
              >
                {active && <span className="absolute left-0 top-1 bottom-1 w-0.5 rounded-r" style={{ background: color }} />}
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: color, opacity: active ? 1 : 0.6 }} />
                <span className="flex-1 truncate">{roleLabel(role)}</span>
                {isCustom && !hasDirt && <span className="text-[9px] text-slate-400 font-medium shrink-0">kustom</span>}
                {hasDirt && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" title="Belum disimpan" />}
              </button>
            )
          })}
        </nav>

        <div className="px-3 py-3 border-t border-slate-200">
          <p className="text-[10px] text-slate-400 leading-relaxed">
            <strong className="text-slate-500">SUPER_ADMIN</strong> &{' '}
            <strong className="text-slate-500">ADMIN</strong> mendapat akses penuh dan tidak bisa diedit.
          </p>
        </div>
      </div>

      {/* ── Right: Permission editor ─────────────────────────────────────── */}
      <div className="flex-1 flex flex-col bg-white">

        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-200">
          <span className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center" style={{ background: activeColor + '20' }}>
            <ShieldCheck size={15} style={{ color: activeColor }} />
          </span>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-slate-900 leading-tight">{roleLabel(selectedRole)}</p>
            <p className="text-xs text-slate-400">{activeCount} permission aktif</p>
          </div>
          {isDirty(selectedRole) && (
            <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-amber-100 text-amber-700">Belum disimpan</span>
          )}
          {isCustomSelected && (
            <button
              onClick={() => setConfirmDelete(selectedRole)}
              className="flex items-center gap-1.5 text-xs font-medium text-red-500 hover:text-red-700 px-2.5 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
            >
              <Trash2 size={12} /> Hapus Role
            </button>
          )}
        </div>

        {/* Confirm delete role */}
        {confirmDelete && (
          <div className="mx-6 mt-4 p-4 rounded-xl border border-red-200 bg-red-50/50 flex items-center gap-4">
            <div className="flex-1 text-sm">
              <p className="font-semibold text-slate-800">Hapus role "<span className="text-red-700">{roleLabel(confirmDelete)}</span>"?</p>
              <p className="text-xs text-slate-500 mt-0.5">User yang memakai role ini tidak akan bisa login dengan benar. Pastikan sudah dipindah rolenya.</p>
            </div>
            <div className="flex gap-2 shrink-0">
              <button onClick={() => setConfirmDelete(null)} className="btn-secondary text-xs px-3">Batal</button>
              <button
                onClick={() => deleteMut.mutate(confirmDelete)}
                disabled={deleteMut.isPending}
                className="btn-danger text-xs px-3"
              >
                {deleteMut.isPending ? '…' : 'Hapus'}
              </button>
            </div>
          </div>
        )}

        {/* Permission list */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
          {groups.map(group => {
            const groupPerms = allPermissions.filter(p => p.group === group)
            const allOn = groupPerms.every(p => activePerms.includes(p.key))
            return (
              <div key={group}>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">{group}</p>
                  <button
                    onClick={() => {
                      const keys = groupPerms.map(p => p.key)
                      const cur  = getPerms(selectedRole)
                      const next = allOn ? cur.filter(k => !keys.includes(k)) : [...new Set([...cur, ...keys])]
                      setDirty(d => ({ ...d, [selectedRole]: next }))
                    }}
                    className="text-[10px] font-semibold text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {allOn ? 'Nonaktifkan semua' : 'Aktifkan semua'}
                  </button>
                </div>

                <div className="space-y-0 rounded-xl overflow-hidden border border-slate-100">
                  {groupPerms.map((perm, idx) => {
                    const checked = activePerms.includes(perm.key)
                    const isLast  = idx === groupPerms.length - 1
                    return (
                      <div
                        key={perm.key}
                        className={`flex items-center gap-4 px-4 py-3.5 bg-white hover:bg-slate-50/60 transition-colors cursor-pointer ${!isLast ? 'border-b border-slate-100' : ''}`}
                        onClick={() => togglePerm(selectedRole, perm.key)}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-800 leading-tight">{perm.label}</p>
                          <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{PERM_DESCRIPTIONS[perm.key] ?? ''}</p>
                        </div>
                        <div className="flex items-center gap-2.5 flex-shrink-0" onClick={e => e.stopPropagation()}>
                          {checked ? <Check size={12} className="text-green-500" /> : <X size={12} className="text-slate-300" />}
                          <Toggle checked={checked} onChange={() => togglePerm(selectedRole, perm.key)} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>

        {/* Action bar */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50/50">
          {!isCustomSelected ? (
            <button
              onClick={() => deleteMut.mutate(selectedRole)}
              disabled={deleteMut.isPending}
              className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-700 transition-colors disabled:opacity-50"
            >
              <RotateCcw size={12} /> Reset ke Default
            </button>
          ) : <div />}
          <div className="flex items-center gap-2">
            {isDirty(selectedRole) && (
              <button
                onClick={handleDiscard}
                className="text-xs font-medium text-slate-500 hover:text-slate-700 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
              >
                Batalkan
              </button>
            )}
            <button
              onClick={handleSave}
              disabled={!isDirty(selectedRole) || updateMut.isPending}
              className="flex items-center gap-1.5 text-sm font-semibold px-4 py-1.5 rounded-lg text-white transition-all disabled:opacity-40"
              style={{ background: isDirty(selectedRole) ? activeColor : '#94A3B8' }}
            >
              <Save size={13} />
              {updateMut.isPending ? 'Menyimpan…' : 'Simpan Perubahan'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function Users() {
  const { isSuperAdmin, user } = useAuth()
  const [tab, setTab] = useState('users')

  const companyId = isSuperAdmin ? null : user?.companyId

  // Fetch roles once so UsersTab dropdown is always up-to-date
  const { data: roleData } = useQuery({
    queryKey: ['role-permissions', companyId],
    queryFn:  () => rolePermissionsApi.getAll(companyId ? { companyId } : {}),
  })

  // All assignable role keys: system editables + custom roles from server
  const serverRoles = roleData?.roles ?? EDITABLE_ROLES.map(key => ({ key, isCustom: false }))
  const allRoles = ['SUPER_ADMIN', 'ADMIN', ...serverRoles.map(r => r.key)]

  return (
    <div className="px-6 py-6 space-y-5">
      <PageHeader
        title="Administrasi Users"
        subtitle="Kelola user dan hak akses per role"
      />

      <div className="flex gap-1 p-1 bg-slate-100 rounded-xl w-fit">
        {[
          { key: 'users',       label: 'Daftar User',    icon: UserCircle2 },
          { key: 'permissions', label: 'Pengaturan Role', icon: ShieldCheck },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === key ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {tab === 'users' && <UsersTab isSuperAdmin={isSuperAdmin} allRoles={allRoles} />}
      {tab === 'permissions' && <PermissionsTab companyId={companyId} />}
    </div>
  )
}
