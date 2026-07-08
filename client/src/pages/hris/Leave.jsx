import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { hrisApi } from '../../api'
import { useAuth } from '../../context/AuthContext'
import { useCompanyGuard } from '../../hooks/useCompanyGuard'
import CompanyRequiredBanner from '../../components/CompanyRequiredBanner'
import { Plus, X, Check, Ban } from 'lucide-react'

const STATUS_LABEL = { PENDING: 'Menunggu', APPROVED: 'Disetujui', REJECTED: 'Ditolak', CANCELLED: 'Dibatalkan' }
const STATUS_COLOR = { PENDING: 'badge-amber', APPROVED: 'badge-green', REJECTED: 'badge-red', CANCELLED: 'badge-muted' }
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

// Tanggal "hari ini" di zona waktu Jakarta — konsisten sama validasi backend
function todayJakarta() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
}

export default function Leave() {
  const { hasPermission, user } = useAuth()
  const canReview = hasPermission('hris.leave.review') || user?.role === 'SUPER_ADMIN' || user?.role === 'COMPANY_ADMIN'
  const { needsCompany } = useCompanyGuard()
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ leaveTypeId: '', startDate: '', endDate: '', reason: '' })
  const [rejecting, setRejecting] = useState(null) // { id, note }

  const { data: types } = useQuery({ queryKey: ['hris-leave-types'], queryFn: hrisApi.leaveTypes })
  const { data: balances, isLoading: balancesLoading, isError: balancesError } = useQuery({ queryKey: ['hris-leave-balances'], queryFn: () => hrisApi.leaveBalances({}) })
  const { data: list, isLoading } = useQuery({ queryKey: ['hris-leave-requests'], queryFn: () => hrisApi.leaveRequests({ limit: 30 }) })

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['hris-leave-requests'] })
    qc.invalidateQueries({ queryKey: ['hris-leave-balances'] })
  }

  const create = useMutation({
    mutationFn: hrisApi.createLeave,
    onSuccess: () => { toast.success('Pengajuan cuti dikirim'); setShowForm(false); setForm({ leaveTypeId: '', startDate: '', endDate: '', reason: '' }); invalidate() },
    onError: (e) => toast.error(e.response?.data?.message ?? 'Gagal mengajukan cuti'),
  })
  const review = useMutation({
    mutationFn: ({ id, status, reviewNote }) => hrisApi.reviewLeave(id, { status, reviewNote }),
    onSuccess: () => { toast.success('Pengajuan direview'); setRejecting(null); invalidate() },
    onError: (e) => toast.error(e.response?.data?.message ?? 'Gagal review'),
  })
  const cancel = useMutation({
    mutationFn: hrisApi.cancelLeave,
    onSuccess: () => { toast.success('Pengajuan dibatalkan'); invalidate() },
    onError: (e) => toast.error(e.response?.data?.message ?? 'Gagal membatalkan'),
  })

  const rows = list?.data ?? []

  return (
    <div className="px-6 py-6 max-w-5xl">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-bold text-slate-800">Cuti</h1>
          <p className="text-xs text-slate-400 mt-0.5">Ajukan cuti dan pantau statusnya</p>
        </div>
        <button
          onClick={() => { if (!showForm && needsCompany) return toast.error('Pilih perusahaan terlebih dahulu'); setShowForm(v => !v) }}
          className="btn-primary text-sm flex items-center gap-1.5"
        >
          {showForm ? <X size={14} /> : <Plus size={14} />} {showForm ? 'Batal' : 'Ajukan Cuti'}
        </button>
      </div>

      {needsCompany && <div className="mb-6"><CompanyRequiredBanner action="mengajukan cuti" /></div>}

      {balancesLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[1,2,3,4].map(i => <div key={i} className="card p-3 h-16 animate-pulse bg-slate-50" />)}
        </div>
      ) : balancesError ? (
        <div className="card p-4 mb-6 text-xs text-red-600 bg-red-50 border border-red-200">
          Gagal memuat saldo cuti. Coba muat ulang halaman.
        </div>
      ) : balances && balances.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {balances.map(b => (
            <div key={b.leaveTypeId} className="card p-3">
              <p className="text-xs font-semibold text-slate-600">{b.leaveTypeName}</p>
              <p className="text-lg font-bold text-brand mt-1">{b.remaining} <span className="text-xs font-normal text-slate-400">/ {b.allocated} hari</span></p>
              <p className="text-[11px] text-slate-400 mt-0.5">Terpakai {b.used} hari</p>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <form
          onSubmit={(e) => { e.preventDefault(); create.mutate(form) }}
          className="card p-5 mb-6 grid sm:grid-cols-2 gap-4"
        >
          <div>
            <label className="label">Jenis Cuti</label>
            <select required className="select" value={form.leaveTypeId} onChange={e => setForm(f => ({ ...f, leaveTypeId: e.target.value }))}>
              <option value="">Pilih jenis cuti</option>
              {(types ?? []).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div />
          <div>
            <label className="label">Mulai</label>
            <input
              type="date" required min={todayJakarta()} className="input" value={form.startDate}
              onChange={e => setForm(f => ({ ...f, startDate: e.target.value, endDate: f.endDate && f.endDate < e.target.value ? e.target.value : f.endDate }))}
            />
          </div>
          <div>
            <label className="label">Selesai</label>
            <input
              type="date" required min={form.startDate || todayJakarta()} className="input" value={form.endDate}
              onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Alasan</label>
            <textarea className="input" rows={3} value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} />
          </div>
          <div className="sm:col-span-2 flex justify-end">
            <button type="submit" disabled={create.isPending} className="btn-primary text-sm">
              {create.isPending ? 'Mengirim…' : 'Kirim Pengajuan'}
            </button>
          </div>
        </form>
      )}

      {rejecting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4" onClick={() => setRejecting(null)}>
          <div className="card w-full max-w-sm p-5" onClick={e => e.stopPropagation()}>
            <p className="text-sm font-semibold text-slate-800 mb-1">Tolak Pengajuan Cuti</p>
            <p className="text-xs text-slate-400 mb-3">Alasan penolakan (opsional) akan terlihat oleh karyawan.</p>
            <label className="label">Catatan</label>
            <textarea className="input mb-3" rows={3} value={rejecting.note} onChange={e => setRejecting(r => ({ ...r, note: e.target.value }))} />
            <div className="flex justify-end gap-2">
              <button onClick={() => setRejecting(null)} className="btn-secondary text-sm">Batal</button>
              <button
                onClick={() => review.mutate({ id: rejecting.id, status: 'REJECTED', reviewNote: rejecting.note || undefined })}
                disabled={review.isPending}
                className="btn-danger text-sm"
              >
                {review.isPending ? 'Menolak…' : 'Tolak'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                {canReview && <th className="th">Nama</th>}
                <th className="th">Jenis</th>
                <th className="th">Periode</th>
                <th className="th">Hari</th>
                <th className="th">Alasan</th>
                <th className="th text-center">Status</th>
                <th className="th text-center">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={7} className="td py-8 text-center text-slate-400">Memuat…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={7} className="td py-8 text-center text-slate-400">Belum ada pengajuan cuti</td></tr>
              ) : rows.map(r => (
                <tr key={r.id} className="tr">
                  {canReview && <td className="td">{r.user?.name ?? '—'}</td>}
                  <td className="td">{r.leaveType?.name ?? '—'}</td>
                  <td className="td">{fmtDate(r.startDate)} – {fmtDate(r.endDate)}</td>
                  <td className="td">{r.days}</td>
                  <td className="td max-w-[200px] truncate">{r.reason || '—'}</td>
                  <td className="td text-center"><span className={STATUS_COLOR[r.status]}>{STATUS_LABEL[r.status]}</span></td>
                  <td className="td text-center">
                    <div className="flex gap-1.5 justify-center">
                      {canReview && r.status === 'PENDING' && (
                        <>
                          <button title="Setujui" onClick={() => review.mutate({ id: r.id, status: 'APPROVED' })} className="w-7 h-7 rounded flex items-center justify-center text-emerald-600 hover:bg-emerald-50">
                            <Check size={14} />
                          </button>
                          <button title="Tolak" onClick={() => setRejecting({ id: r.id, note: '' })} className="w-7 h-7 rounded flex items-center justify-center text-red-600 hover:bg-red-50">
                            <X size={14} />
                          </button>
                        </>
                      )}
                      {!canReview && r.status === 'PENDING' && (
                        <button title="Batalkan" onClick={() => cancel.mutate(r.id)} className="w-7 h-7 rounded flex items-center justify-center text-slate-500 hover:bg-slate-100">
                          <Ban size={14} />
                        </button>
                      )}
                      {canReview && r.status === 'APPROVED' && (
                        <button title="Batalkan approval (kembalikan saldo)" onClick={() => { if (confirm('Batalkan cuti yang sudah disetujui ini? Saldo cuti akan dikembalikan.')) cancel.mutate(r.id) }} className="w-7 h-7 rounded flex items-center justify-center text-slate-500 hover:bg-slate-100">
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
