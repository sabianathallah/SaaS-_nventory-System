import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { hrisApi } from '../../../api'
import { Plus, X, Trash2, Users } from 'lucide-react'
import { useCompanyGuard } from '../../../hooks/useCompanyGuard'
import CompanyRequiredBanner from '../../../components/CompanyRequiredBanner'

export default function Shifts() {
  const qc = useQueryClient()
  const { needsCompany } = useCompanyGuard()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', startTime: '', endTime: '' })
  const [assigning, setAssigning] = useState(null)

  const { data: shifts, isLoading } = useQuery({ queryKey: ['hris-shifts'], queryFn: hrisApi.shifts })
  const { data: users } = useQuery({ queryKey: ['hris-shift-users'], queryFn: hrisApi.shiftUsers })

  const invalidate = () => { qc.invalidateQueries({ queryKey: ['hris-shifts'] }); qc.invalidateQueries({ queryKey: ['hris-shift-users'] }) }

  const create = useMutation({
    mutationFn: hrisApi.createShift,
    onSuccess: () => { toast.success('Shift ditambahkan'); setShowForm(false); setForm({ name: '', startTime: '', endTime: '' }); invalidate() },
    onError: (e) => toast.error(e.response?.data?.message ?? 'Gagal menambahkan shift'),
  })
  const destroy = useMutation({
    mutationFn: hrisApi.deleteShift,
    onSuccess: () => { toast.success('Shift dihapus'); invalidate() },
    onError: (e) => toast.error(e.response?.data?.message ?? 'Gagal menghapus shift'),
  })
  const assign = useMutation({
    mutationFn: hrisApi.assignShift,
    onSuccess: () => { toast.success('Shift ditetapkan'); invalidate() },
    onError: (e) => toast.error(e.response?.data?.message ?? 'Gagal menetapkan shift'),
  })

  return (
    <div className="px-6 py-6 max-w-5xl">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-bold text-slate-800">Kelola Shift</h1>
          <p className="text-xs text-slate-400 mt-0.5">Buat shift dan tetapkan ke karyawan</p>
        </div>
        <button
          onClick={() => {
            if (!showForm && needsCompany) return toast.error('Pilih perusahaan terlebih dahulu')
            setShowForm(v => !v)
          }}
          className="btn-primary text-sm flex items-center gap-1.5"
        >
          {showForm ? <X size={14} /> : <Plus size={14} />} {showForm ? 'Batal' : 'Tambah Shift'}
        </button>
      </div>

      {needsCompany && <div className="mb-6"><CompanyRequiredBanner action="mengelola shift" /></div>}

      {showForm && (
        <form
          onSubmit={(e) => { e.preventDefault(); create.mutate(form) }}
          className="card p-5 mb-6 grid sm:grid-cols-3 gap-4"
        >
          <div>
            <label className="label">Nama Shift</label>
            <input required className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Shift Pagi" />
          </div>
          <div>
            <label className="label">Jam Mulai</label>
            <input type="time" required className="input" value={form.startTime} onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))} />
          </div>
          <div>
            <label className="label">Jam Selesai</label>
            <input type="time" required className="input" value={form.endTime} onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))} />
          </div>
          <div className="sm:col-span-3 flex justify-end">
            <button type="submit" disabled={create.isPending} className="btn-primary text-sm">
              {create.isPending ? 'Menyimpan…' : 'Simpan Shift'}
            </button>
          </div>
        </form>
      )}

      <div className="card overflow-hidden mb-6">
        <div className="px-4 py-3 border-b border-slate-100"><p className="text-sm font-semibold text-slate-700">Daftar Shift</p></div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr><th className="th">Nama</th><th className="th">Jam</th><th className="th text-center">Aksi</th></tr></thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={3} className="td py-8 text-center text-slate-400">Memuat…</td></tr>
              ) : (shifts ?? []).length === 0 ? (
                <tr><td colSpan={3} className="td py-8 text-center text-slate-400">Belum ada shift</td></tr>
              ) : shifts.map(s => (
                <tr key={s.id} className="tr">
                  <td className="td">{s.name}</td>
                  <td className="td">{s.startTime} – {s.endTime}</td>
                  <td className="td text-center">
                    <button disabled={needsCompany} title="Hapus" onClick={() => destroy.mutate(s.id)} className="w-7 h-7 rounded flex items-center justify-center text-red-500 hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed">
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
          <Users size={14} className="text-slate-400" />
          <p className="text-sm font-semibold text-slate-700">Penetapan Shift Karyawan</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr><th className="th">Nama</th><th className="th">Divisi</th><th className="th">Shift</th></tr></thead>
            <tbody>
              {(users ?? []).map(u => (
                <tr key={u.id} className="tr">
                  <td className="td">{u.name}</td>
                  <td className="td">{u.divisi || '—'}</td>
                  <td className="td">
                    <select
                      disabled={needsCompany}
                      className="select text-xs w-40 disabled:opacity-40 disabled:cursor-not-allowed"
                      value={assigning?.id === u.id ? assigning.shiftId : (u.shiftId ?? '')}
                      onChange={e => {
                        const shiftId = e.target.value || null
                        setAssigning({ id: u.id, shiftId })
                        assign.mutate({ userId: u.id, shiftId })
                      }}
                    >
                      <option value="">Tanpa Shift</option>
                      {(shifts ?? []).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
