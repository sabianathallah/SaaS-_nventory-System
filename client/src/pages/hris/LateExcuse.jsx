import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { hrisApi } from '../../api'
import { useAuth } from '../../context/AuthContext'
import { Plus, X, Check, Ban } from 'lucide-react'

const STATUS_LABEL = { PENDING: 'Menunggu', APPROVED: 'Disetujui', REJECTED: 'Ditolak', CANCELLED: 'Dibatalkan' }
const STATUS_COLOR = { PENDING: 'badge-amber', APPROVED: 'badge-green', REJECTED: 'badge-red', CANCELLED: 'badge-muted' }
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

export default function LateExcuse() {
  const { hasPermission, user } = useAuth()
  const canReview = hasPermission('hris.attendance.review') || user?.role === 'SUPER_ADMIN' || user?.role === 'COMPANY_ADMIN'
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ date: '', expectedTime: '', reason: '' })

  const now = new Date()
  const { data: list, isLoading } = useQuery({ queryKey: ['hris-late-excuse'], queryFn: () => hrisApi.lateExcuseList({ limit: 30 }) })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['hris-late-excuse'] })

  const create = useMutation({
    mutationFn: hrisApi.createLateExcuse,
    onSuccess: () => { toast.success('Izin telat diajukan'); setShowForm(false); setForm({ date: '', expectedTime: '', reason: '' }); invalidate() },
    onError: (e) => toast.error(e.response?.data?.message ?? 'Gagal mengajukan izin telat'),
  })
  const review = useMutation({
    mutationFn: ({ id, status }) => hrisApi.reviewLateExcuse(id, { status }),
    onSuccess: () => { toast.success('Pengajuan direview'); invalidate() },
    onError: (e) => toast.error(e.response?.data?.message ?? 'Gagal review'),
  })
  const cancel = useMutation({
    mutationFn: hrisApi.cancelLateExcuse,
    onSuccess: () => { toast.success('Pengajuan dibatalkan'); invalidate() },
    onError: (e) => toast.error(e.response?.data?.message ?? 'Gagal membatalkan'),
  })

  const rows = list?.data ?? []

  return (
    <div className="px-6 py-6 max-w-5xl">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-bold text-slate-800">Izin Telat</h1>
          <p className="text-xs text-slate-400 mt-0.5">Ajukan izin duluan kalau sudah tau bakal telat (mis. ada urusan pagi) — kalau disetujui, check-in nanti gak dianggap terlambat</p>
        </div>
        <button onClick={() => setShowForm(v => !v)} className="btn-primary text-sm flex items-center gap-1.5">
          {showForm ? <X size={14} /> : <Plus size={14} />} {showForm ? 'Batal' : 'Ajukan Izin Telat'}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={(e) => { e.preventDefault(); create.mutate(form) }}
          className="card p-5 mb-6 grid sm:grid-cols-2 gap-4"
        >
          <div>
            <label className="label">Tanggal</label>
            <input type="date" required min={now.toISOString().slice(0, 10)} className="input" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
          </div>
          <div>
            <label className="label">Perkiraan Jam Datang</label>
            <input type="time" className="input" value={form.expectedTime} onChange={e => setForm(f => ({ ...f, expectedTime: e.target.value }))} />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Alasan</label>
            <textarea required className="input" rows={3} value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} />
          </div>
          <div className="sm:col-span-2 flex justify-end">
            <button type="submit" disabled={create.isPending} className="btn-primary text-sm">
              {create.isPending ? 'Mengirim…' : 'Kirim Pengajuan'}
            </button>
          </div>
        </form>
      )}

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                {canReview && <th className="th">Nama</th>}
                <th className="th">Tanggal</th>
                <th className="th">Perkiraan Jam</th>
                <th className="th">Alasan</th>
                <th className="th text-center">Status</th>
                <th className="th text-center">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={6} className="td py-8 text-center text-slate-400">Memuat…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={6} className="td py-8 text-center text-slate-400">Belum ada pengajuan izin telat</td></tr>
              ) : rows.map(r => (
                <tr key={r.id} className="tr">
                  {canReview && <td className="td">{r.user?.name ?? '—'}</td>}
                  <td className="td">{fmtDate(r.date)}</td>
                  <td className="td">{r.expectedTime || '—'}</td>
                  <td className="td max-w-[220px] truncate">{r.reason || '—'}</td>
                  <td className="td text-center"><span className={STATUS_COLOR[r.status]}>{STATUS_LABEL[r.status]}</span></td>
                  <td className="td text-center">
                    <div className="flex gap-1.5 justify-center">
                      {canReview && r.status === 'PENDING' && (
                        <>
                          <button title="Setujui" onClick={() => review.mutate({ id: r.id, status: 'APPROVED' })} className="w-7 h-7 rounded flex items-center justify-center text-emerald-600 hover:bg-emerald-50">
                            <Check size={14} />
                          </button>
                          <button title="Tolak" onClick={() => review.mutate({ id: r.id, status: 'REJECTED' })} className="w-7 h-7 rounded flex items-center justify-center text-red-600 hover:bg-red-50">
                            <X size={14} />
                          </button>
                        </>
                      )}
                      {!canReview && r.status === 'PENDING' && (
                        <button title="Batalkan" onClick={() => cancel.mutate(r.id)} className="w-7 h-7 rounded flex items-center justify-center text-slate-500 hover:bg-slate-100">
                          <Ban size={14} />
                        </button>
                      )}
                    </div>
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
