import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { hrisApi } from '../../../api'
import { useAuth } from '../../../context/AuthContext'
import { Save, Plus, Pencil, EyeOff, Eye, X } from 'lucide-react'
import { useCompanyGuard } from '../../../hooks/useCompanyGuard'
import CompanyRequiredBanner from '../../../components/CompanyRequiredBanner'

const EMPTY_TYPE_FORM = { name: '', maxDaysPerYear: 12 }

export default function LeaveQuota() {
  const qc = useQueryClient()
  const { hasPermission, user } = useAuth()
  const canManageTypes = hasPermission('hris.manage') || user?.role === 'SUPER_ADMIN' || user?.role === 'COMPANY_ADMIN'
  const { needsCompany } = useCompanyGuard()
  const [year, setYear] = useState(new Date().getFullYear())
  const [drafts, setDrafts] = useState({}) // `${userId}:${leaveTypeId}` -> value

  const [editingType, setEditingType] = useState(null) // null = tidak ada modal, {} = tambah baru, {id,...} = edit
  const [typeForm, setTypeForm] = useState(EMPTY_TYPE_FORM)

  const { data, isLoading } = useQuery({
    queryKey: ['hris-leave-balances-admin', year],
    queryFn: () => hrisApi.leaveBalancesAdmin({ year }),
  })
  const { data: allTypes } = useQuery({
    queryKey: ['hris-leave-types-all'],
    queryFn: () => hrisApi.leaveTypes({ includeInactive: true }),
    enabled: canManageTypes,
  })

  const adjust = useMutation({
    mutationFn: hrisApi.adjustLeaveBalance,
    onSuccess: () => { toast.success('Kuota diperbarui'); qc.invalidateQueries({ queryKey: ['hris-leave-balances-admin'] }) },
    onError: (e) => toast.error(e.response?.data?.message ?? 'Gagal update kuota'),
  })

  const invalidateTypes = () => {
    qc.invalidateQueries({ queryKey: ['hris-leave-types-all'] })
    qc.invalidateQueries({ queryKey: ['hris-leave-balances-admin'] })
    qc.invalidateQueries({ queryKey: ['hris-leave-types'] })
  }
  const createType = useMutation({
    mutationFn: hrisApi.createLeaveType,
    onSuccess: () => { toast.success('Jenis cuti ditambahkan'); setEditingType(null); invalidateTypes() },
    onError: (e) => toast.error(e.response?.data?.message ?? 'Gagal menambahkan jenis cuti'),
  })
  const updateType = useMutation({
    mutationFn: ({ id, data }) => hrisApi.updateLeaveType(id, data),
    onSuccess: () => { toast.success('Jenis cuti diperbarui'); setEditingType(null); invalidateTypes() },
    onError: (e) => toast.error(e.response?.data?.message ?? 'Gagal memperbarui jenis cuti'),
  })

  function openAddType() {
    setTypeForm(EMPTY_TYPE_FORM)
    setEditingType({})
  }
  function openEditType(t) {
    setTypeForm({ name: t.name, maxDaysPerYear: t.maxDaysPerYear })
    setEditingType(t)
  }
  function submitType(e) {
    e.preventDefault()
    if (!typeForm.name.trim()) return toast.error('Nama jenis cuti wajib diisi')
    const payload = { name: typeForm.name.trim(), maxDaysPerYear: Number(typeForm.maxDaysPerYear) || 0 }
    if (editingType?.id) updateType.mutate({ id: editingType.id, data: payload })
    else createType.mutate(payload)
  }
  function toggleActive(t) {
    updateType.mutate({ id: t.id, data: { isActive: !t.isActive } })
  }

  const types = data?.types ?? []
  const users = data?.users ?? []

  function keyOf(userId, leaveTypeId) { return `${userId}:${leaveTypeId}` }

  function handleSave(userId, leaveTypeId) {
    if (needsCompany) return toast.error('Pilih perusahaan terlebih dahulu')
    const k = keyOf(userId, leaveTypeId)
    const value = drafts[k]
    if (value === undefined || value === '') return
    adjust.mutate({ userId, leaveTypeId, year, allocated: Number(value) })
  }

  return (
    <div className="px-6 py-6 max-w-5xl">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-bold text-slate-800">Kuota Cuti</h1>
          <p className="text-xs text-slate-400 mt-0.5">Atur jatah cuti per karyawan per jenis cuti untuk tahun tertentu</p>
        </div>
        <select className="select w-32" value={year} onChange={e => setYear(Number(e.target.value))}>
          {[year - 1, year, year + 1].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {needsCompany && <div className="mb-4"><CompanyRequiredBanner action="mengatur kuota cuti" /></div>}

      {canManageTypes && (
        <div className="card overflow-hidden mb-6">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-700">Jenis Cuti</p>
            <button onClick={openAddType} className="btn-secondary text-xs flex items-center gap-1.5">
              <Plus size={13} /> Tambah Jenis Cuti
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="th">Nama</th>
                  <th className="th text-center">Maks Hari/Tahun</th>
                  <th className="th text-center">Status</th>
                  <th className="th text-center">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {(allTypes ?? []).length === 0 ? (
                  <tr><td colSpan={4} className="td py-6 text-center text-slate-400">Belum ada jenis cuti</td></tr>
                ) : (allTypes ?? []).map(t => (
                  <tr key={t.id} className="tr">
                    <td className="td">{t.name}</td>
                    <td className="td text-center">{t.maxDaysPerYear}</td>
                    <td className="td text-center">
                      <span className={t.isActive ? 'badge-green' : 'badge-muted'}>{t.isActive ? 'Aktif' : 'Nonaktif'}</span>
                    </td>
                    <td className="td text-center">
                      <div className="flex gap-1.5 justify-center">
                        <button title="Edit" onClick={() => openEditType(t)} className="w-7 h-7 rounded flex items-center justify-center text-slate-500 hover:bg-slate-100">
                          <Pencil size={13} />
                        </button>
                        <button
                          title={t.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                          onClick={() => toggleActive(t)}
                          className={`w-7 h-7 rounded flex items-center justify-center hover:bg-slate-100 ${t.isActive ? 'text-red-500' : 'text-emerald-600'}`}
                        >
                          {t.isActive ? <EyeOff size={13} /> : <Eye size={13} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="px-4 py-2 text-[11px] text-slate-400 border-t border-slate-100">
            Nonaktifkan jenis cuti hanya menyembunyikannya dari pengajuan baru — data cuti & kuota yang sudah ada tidak terhapus.
          </p>
        </div>
      )}

      {editingType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4" onClick={() => setEditingType(null)}>
          <form onSubmit={submitType} className="card w-full max-w-sm p-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-semibold text-slate-800">{editingType?.id ? 'Edit Jenis Cuti' : 'Tambah Jenis Cuti'}</p>
              <button type="button" onClick={() => setEditingType(null)} className="text-slate-400 hover:text-slate-600"><X size={16} /></button>
            </div>
            <label className="label">Nama</label>
            <input autoFocus required className="input mb-3" value={typeForm.name} onChange={e => setTypeForm(f => ({ ...f, name: e.target.value }))} placeholder="mis. Cuti Melahirkan" />
            <label className="label">Maksimal Hari per Tahun</label>
            <input type="number" min="0" required className="input mb-4" value={typeForm.maxDaysPerYear} onChange={e => setTypeForm(f => ({ ...f, maxDaysPerYear: e.target.value }))} />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setEditingType(null)} className="btn-secondary text-sm">Batal</button>
              <button type="submit" disabled={createType.isPending || updateType.isPending} className="btn-primary text-sm">
                {(createType.isPending || updateType.isPending) ? 'Menyimpan…' : 'Simpan'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="th">Nama</th>
                {types.map(t => <th key={t.id} className="th text-center">{t.name}</th>)}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={types.length + 1} className="td py-8 text-center text-slate-400">Memuat…</td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan={types.length + 1} className="td py-8 text-center text-slate-400">Belum ada user</td></tr>
              ) : users.map(u => (
                <tr key={u.userId} className="tr">
                  <td className="td">
                    <div className="font-medium">{u.userName}</div>
                    {u.divisi && <div className="text-xs text-slate-400">{u.divisi}</div>}
                  </td>
                  {u.balances.map(b => {
                    const k = keyOf(u.userId, b.leaveTypeId)
                    const draft = drafts[k]
                    const value = draft !== undefined ? draft : b.allocated
                    return (
                      <td key={b.leaveTypeId} className="td text-center">
                        <div className="flex items-center justify-center gap-1">
                          <input
                            type="number" min="0"
                            disabled={needsCompany}
                            className="input w-16 text-center text-xs py-1 disabled:opacity-40 disabled:cursor-not-allowed"
                            value={value}
                            onChange={e => setDrafts(d => ({ ...d, [k]: e.target.value }))}
                          />
                          <button
                            disabled={needsCompany}
                            title="Simpan"
                            onClick={() => handleSave(u.userId, b.leaveTypeId)}
                            className="w-6 h-6 rounded flex items-center justify-center text-brand hover:bg-brand-50 disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <Save size={12} />
                          </button>
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">terpakai {b.used}</div>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
