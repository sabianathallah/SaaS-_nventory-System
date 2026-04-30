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

const ALL_ROLES = ['SUPER_ADMIN', 'ADMIN', 'COMPANY_ADMIN', 'OPERASIONAL', 'HEAD_PACKING', 'TIM_PACKING', 'HR', 'CEO']
const EDITABLE_ROLES = ['COMPANY_ADMIN', 'OPERASIONAL', 'HEAD_PACKING', 'TIM_PACKING', 'HR', 'CEO']

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

const ROLE_LABEL = {
  SUPER_ADMIN:   'Super Admin',
  ADMIN:         'Admin',
  COMPANY_ADMIN: 'Company Admin',
  OPERASIONAL:   'Operasional',
  HEAD_PACKING:  'Head Packing',
  TIM_PACKING:   'Tim Packing',
  HR:            'HR',
  CEO:           'CEO',
}

const EMPTY_FORM = { name: '', email: '', password: '', role: 'OPERASIONAL', companyId: '' }

// ── Users Tab ─────────────────────────────────────────────────────────────────

function UsersTab({ isSuperAdmin }) {
  const qc = useQueryClient()
  const [page, setPage]   = useState(1)
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(null)
  const [form, setForm]   = useState(EMPTY_FORM)

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

  const openEdit = (r) => {
    setForm({ name: r.name, email: r.email, password: '', role: r.role, companyId: r.companyId ?? '' })
    setModal({ mode: 'edit', data: r })
  }
  const openCreate = () => { setForm(EMPTY_FORM); setModal({ mode: 'create' }) }

  const initials = (name = '') => name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  const set = f => e => setForm(v => ({ ...v, [f]: e.target.value }))

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
      render: r => ROLE_BADGE[r.role] ?? <span className="badge-muted text-xs">{r.role}</span>,
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

      {/* Create / Edit Modal */}
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
                {ALL_ROLES.filter(r => r !== 'SUPER_ADMIN').map(r => (
                  <option key={r} value={r}>{ROLE_LABEL[r]}</option>
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

      {/* Delete Modal */}
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

// ── Discord-style constants ───────────────────────────────────────────────────

const ROLE_COLORS = {
  COMPANY_ADMIN: '#3B82F6',
  OPERASIONAL:   '#14B8A6',
  HEAD_PACKING:  '#A855F7',
  TIM_PACKING:   '#8B5CF6',
  HR:            '#EC4899',
  CEO:           '#F59E0B',
}

const PERM_DESCRIPTIONS = {
  'inventory.view':         'Dapat melihat daftar produk, katalog, dan informasi warehouse',
  'inventory.manage':       'Dapat menambah, mengubah, dan menghapus produk serta konfigurasi warehouse',
  'stock.view':             'Dapat melihat level stok saat ini dan riwayat pergerakan stok',
  'stock.manage':           'Dapat melakukan stock in, stock out, dan stock opname',
  'stock.in.scan':          'Stock In: menambah item hanya via scan barcode/QR',
  'stock.in.manual_input':  'Stock In: input produk secara manual tanpa scan (dropdown + qty)',
  'stock.in.delete_item':   'Stock In: menghapus item yang sudah tersimpan di transaksi',
  'stock.out.scan':          'Stock Out: menambah item hanya via scan barcode/QR',
  'stock.out.manual_input':  'Stock Out: input produk secara manual tanpa scan (dropdown + qty)',
  'stock.opname.scan':       'Stock Opname: hitung produk hanya via scan barcode/QR',
  'stock.opname.manual_input':'Stock Opname: input kuantitas produk secara manual tanpa scan',
  'packing.view':           'Dapat mengakses dan melihat semua halaman modul packing',
  'packing.incoming':       'Dapat membuat dan mengelola dokumen barang masuk serta surat jalan',
  'packing.jobs':           'Dapat membuat packing job dan mengassign ke tim packing',
  'packing.verify':         'Dapat memverifikasi hasil packing dan membuat Form Anak Packing (FAP)',
  'reports.dashboard':      'Dapat melihat dashboard statistik dan laporan inventory',
  'admin.users':            'Dapat mengelola akun user (tambah, edit, nonaktifkan)',
}

// Toggle switch component (Discord style)
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
      <span
        className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transform transition-transform duration-200 ${
          checked ? 'translate-x-[18px]' : 'translate-x-[3px]'
        }`}
      />
    </button>
  )
}

// ── Permissions Tab ────────────────────────────────────────────────────────────

function PermissionsTab({ companyId }) {
  const qc = useQueryClient()
  const [selectedRole, setSelectedRole] = useState(EDITABLE_ROLES[0])
  const [dirty, setDirty] = useState({}) // { ROLE: permKeys[] }

  const { data, isLoading } = useQuery({
    queryKey: ['role-permissions', companyId],
    queryFn:  () => rolePermissionsApi.getAll(companyId ? { companyId } : {}),
  })

  const updateMut = useMutation({
    mutationFn: ({ role, permissions }) => rolePermissionsApi.update(role, permissions),
    onSuccess: (_, { role }) => {
      qc.invalidateQueries({ queryKey: ['role-permissions'] })
      setDirty(d => { const n = { ...d }; delete n[role]; return n })
      toast.success(`Permission ${ROLE_LABEL[role]} disimpan`)
    },
    onError: e => toast.error(e.response?.data?.message || 'Error'),
  })

  const resetMut = useMutation({
    mutationFn: (role) => rolePermissionsApi.resetToDefault(role),
    onSuccess: (_, role) => {
      qc.invalidateQueries({ queryKey: ['role-permissions'] })
      setDirty(d => { const n = { ...d }; delete n[role]; return n })
      toast.success(`Permission ${ROLE_LABEL[role]} direset ke default`)
    },
    onError: e => toast.error(e.response?.data?.message || 'Error'),
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-sm text-slate-400">
        Memuat pengaturan role…
      </div>
    )
  }

  const allPermissions = data?.allPermissions ?? []
  const serverPerms    = data?.permissions ?? {}
  const groups         = [...new Set(allPermissions.map(p => p.group))]

  const getPerms  = (role) => dirty[role] ?? serverPerms[role] ?? []
  const isDirty   = (role) => !!dirty[role]
  const activeColor = ROLE_COLORS[selectedRole] ?? '#64748B'

  const togglePerm = (role, key) => {
    const cur  = getPerms(role)
    const next = cur.includes(key) ? cur.filter(k => k !== key) : [...cur, key]
    setDirty(d => ({ ...d, [role]: next }))
  }

  const handleSave  = () => updateMut.mutate({ role: selectedRole, permissions: getPerms(selectedRole) })
  const handleReset = () => resetMut.mutate(selectedRole)
  const handleDiscard = () => setDirty(d => { const n = { ...d }; delete n[selectedRole]; return n })

  const activePerms  = getPerms(selectedRole)
  const activeCount  = activePerms.length

  return (
    <div className="flex gap-0 rounded-2xl overflow-hidden border border-slate-200 shadow-sm" style={{ minHeight: 520 }}>

      {/* ── Left: Role list ─────────────────────────────────────────────── */}
      <div className="w-52 flex-shrink-0 bg-slate-50 border-r border-slate-200 flex flex-col">
        <div className="px-4 py-3 border-b border-slate-200">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Roles</p>
        </div>
        <nav className="flex-1 overflow-y-auto py-2">
          {EDITABLE_ROLES.map(role => {
            const color   = ROLE_COLORS[role] ?? '#64748B'
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
                {/* Active indicator */}
                {active && (
                  <span
                    className="absolute left-0 top-1 bottom-1 w-0.5 rounded-r"
                    style={{ background: color }}
                  />
                )}
                {/* Role color dot */}
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ background: color, opacity: active ? 1 : 0.6 }}
                />
                <span className="flex-1 truncate">{ROLE_LABEL[role]}</span>
                {/* Unsaved dot */}
                {hasDirt && (
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" title="Ada perubahan belum disimpan" />
                )}
              </button>
            )
          })}
        </nav>

        {/* Fixed roles notice */}
        <div className="px-3 py-3 border-t border-slate-200">
          <p className="text-[10px] text-slate-400 leading-relaxed">
            <strong className="text-slate-500">SUPER_ADMIN</strong>,{' '}
            <strong className="text-slate-500">ADMIN</strong> &{' '}
            <strong className="text-slate-500">COMPANY_ADMIN</strong> mendapat akses penuh dan tidak bisa diedit.
          </p>
        </div>
      </div>

      {/* ── Right: Permission editor ─────────────────────────────────────── */}
      <div className="flex-1 flex flex-col bg-white">

        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-200">
          <span
            className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center"
            style={{ background: activeColor + '20' }}
          >
            <ShieldCheck size={15} style={{ color: activeColor }} />
          </span>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-slate-900 leading-tight">{ROLE_LABEL[selectedRole]}</p>
            <p className="text-xs text-slate-400">{activeCount} permission aktif</p>
          </div>
          {isDirty(selectedRole) && (
            <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-amber-100 text-amber-700">
              Belum disimpan
            </span>
          )}
        </div>

        {/* Permission list */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
          {groups.map(group => {
            const groupPerms = allPermissions.filter(p => p.group === group)
            const allOn = groupPerms.every(p => activePerms.includes(p.key))
            return (
              <div key={group}>
                {/* Group header */}
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">{group}</p>
                  <button
                    onClick={() => {
                      const keys = groupPerms.map(p => p.key)
                      const cur  = getPerms(selectedRole)
                      const next = allOn
                        ? cur.filter(k => !keys.includes(k))
                        : [...new Set([...cur, ...keys])]
                      setDirty(d => ({ ...d, [selectedRole]: next }))
                    }}
                    className="text-[10px] font-semibold text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {allOn ? 'Nonaktifkan semua' : 'Aktifkan semua'}
                  </button>
                </div>

                {/* Permission rows */}
                <div className="space-y-0 rounded-xl overflow-hidden border border-slate-100">
                  {groupPerms.map((perm, idx) => {
                    const checked = activePerms.includes(perm.key)
                    const isLast  = idx === groupPerms.length - 1
                    return (
                      <div
                        key={perm.key}
                        className={`flex items-center gap-4 px-4 py-3.5 bg-white hover:bg-slate-50/60 transition-colors cursor-pointer ${
                          !isLast ? 'border-b border-slate-100' : ''
                        }`}
                        onClick={() => togglePerm(selectedRole, perm.key)}
                      >
                        {/* Text */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-800 leading-tight">{perm.label}</p>
                          <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                            {PERM_DESCRIPTIONS[perm.key] ?? ''}
                          </p>
                        </div>
                        {/* Status icon + toggle */}
                        <div className="flex items-center gap-2.5 flex-shrink-0" onClick={e => e.stopPropagation()}>
                          {checked
                            ? <Check size={12} className="text-green-500" />
                            : <X    size={12} className="text-slate-300" />
                          }
                          <Toggle
                            checked={checked}
                            onChange={() => togglePerm(selectedRole, perm.key)}
                          />
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
          <button
            onClick={handleReset}
            disabled={resetMut.isPending}
            className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-700 transition-colors disabled:opacity-50"
          >
            <RotateCcw size={12} />
            Reset ke Default
          </button>
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

  return (
    <div className="px-6 py-6 space-y-5">
      <PageHeader
        title="Administrasi Users"
        subtitle="Kelola user dan hak akses per role"
      />

      {/* Tab bar */}
      <div className="flex gap-1 p-1 bg-slate-100 rounded-xl w-fit">
        {[
          { key: 'users',       label: 'Daftar User',    icon: UserCircle2 },
          { key: 'permissions', label: 'Pengaturan Role', icon: ShieldCheck },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === key
                ? 'bg-white shadow-sm text-slate-800'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {tab === 'users' && <UsersTab isSuperAdmin={isSuperAdmin} />}
      {tab === 'permissions' && <PermissionsTab companyId={isSuperAdmin ? null : user?.companyId} />}
    </div>
  )
}
