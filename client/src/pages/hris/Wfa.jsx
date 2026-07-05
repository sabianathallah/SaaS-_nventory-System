import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { hrisApi } from '../../api'
import { useAuth } from '../../context/AuthContext'
import { Plus, X, Check, Ban, AlertTriangle } from 'lucide-react'

const STATUS_LABEL = { PENDING: 'Menunggu', APPROVED: 'Disetujui', REJECTED: 'Ditolak', CANCELLED: 'Dibatalkan' }
const STATUS_COLOR = { PENDING: 'badge-amber', APPROVED: 'badge-green', REJECTED: 'badge-red', CANCELLED: 'badge-muted' }
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

export default function Wfa() {
  const { hasPermission, user } = useAuth()
  const canReview = hasPermission('hris.leave.review') || user?.role === 'SUPER_ADMIN' || user?.role === 'COMPANY_ADMIN'
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ date: '', reason: '' })
  const [reviewing, setReviewing] = useState(null) // { id, amount, note }

  const now = new Date()
  const { data: quota } = useQuery({ queryKey: ['hris-wfa-quota'], queryFn: () => hrisApi.wfaQuota({}) })
  const { data: list, isLoading } = useQuery({ queryKey: ['hris-wfa-requests'], queryFn: () => hrisApi.wfaRequests({ limit: 30 }) })

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['hris-wfa-requests'] })
    qc.invalidateQueries({ queryKey: ['hris-wfa-quota'] })
  }

  const create = useMutation({
    mutationFn: hrisApi.createWfa,
    onSuccess: () => { toast.success('Pengajuan WFA dikirim'); setShowForm(false); setForm({ date: '', reason: '' }); invalidate() },
    onError: (e) => toast.error(e.response?.data?.message ?? 'Gagal mengajukan WFA'),
  })
  const review = useMutation({
    mutationFn: ({ id, status, adjustmentAmount, adjustmentNote }) => hrisApi.reviewWfa(id, { status, adjustmentAmount, adjustmentNote }),
    onSuccess: () => { toast.success('Pengajuan direview'); setReviewing(null); invalidate() },
    onError: (e) => toast.error(e.response?.data?.message ?? 'Gagal review'),
  })
  const cancel = useMutation({
    mutationFn: hrisApi.cancelWfa,
    onSuccess: () => { toast.success('Pengajuan dibatalkan'); invalidate() },
    onError: (e) => toast.error(e.response?.data?.message ?? 'Gagal membatalkan'),
  })

  function handleApproveClick(r) {
    if (r.isOverQuota) setReviewing({ id: r.id, amount: '', note: '' })
    else review.mutate({ id: r.id, status: 'APPROVED' })
  }

  const rows = list?.data ?? []

  return (
    <div className="px-6 py-6 max-w-5xl">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-bold text-slate-800">WFA (Work From Anywhere)</h1>
          <p className="text-xs text-slate-400 mt-0.5">Ajukan WFA per hari dan pantau statusnya</p>
        </div>
        <button onClick={() => setShowForm(v => !v)} className="btn-primary text-sm flex items-center gap-1.5">
          {showForm ? <X size={14} /> : <Plus size={14} />} {showForm ? 'Batal' : 'Ajukan WFA'}
        </button>
      </div>

      {quota && (
        <div className="card p-4 mb-6 flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="text-xs font-semibold text-slate-600">Kuota WFA Bulan Ini</p>
            <p className="text-lg font-bold text-brand mt-0.5">{quota.remaining} <span className="text-xs font-normal text-slate-400">/ {quota.allocated} hari</span></p>
          </div>
          {quota.remaining <= 0 && (
            <div className="flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              <AlertTriangle size={13} /> Kuota habis — tetap bisa mengajukan, akan ditandai "Melebihi Kuota"
            </div>
          )}
        </div>
      )}

      {showForm && (
        <form
          onSubmit={(e) => { e.preventDefault(); create.mutate(form) }}
          className="card p-5 mb-6 grid sm:grid-cols-2 gap-4"
        >
          <div>
            <label className="label">Tanggal</label>
            <input type="date" required min={now.toISOString().slice(0, 10)} className="input" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
          </div>
          <div />
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

      {reviewing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4" onClick={() => setReviewing(null)}>
          <div className="card w-full max-w-sm p-5" onClick={e => e.stopPropagation()}>
            <p className="text-sm font-semibold text-slate-800 mb-1">Setujui WFA Melebihi Kuota</p>
            <p className="text-xs text-slate-400 mb-3">Isi nominal penyesuaian payment (opsional) untuk kasus ini.</p>
            <label className="label">Nominal Penyesuaian (Rp)</label>
            <input type="number" min="0" className="input mb-3" value={reviewing.amount} onChange={e => setReviewing(r => ({ ...r, amount: e.target.value }))} />
            <label className="label">Catatan</label>
            <textarea className="input mb-3" rows={2} value={reviewing.note} onChange={e => setReviewing(r => ({ ...r, note: e.target.value }))} />
            <div className="flex justify-end gap-2">
              <button onClick={() => setReviewing(null)} className="btn-secondary text-sm">Batal</button>
              <button
                onClick={() => review.mutate({ id: reviewing.id, status: 'APPROVED', adjustmentAmount: reviewing.amount || undefined, adjustmentNote: reviewing.note || undefined })}
                className="btn-primary text-sm"
              >
                Setujui
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
                <th className="th">Tanggal</th>
                <th className="th">Alasan</th>
                <th className="th text-center">Kuota</th>
                <th className="th text-center">Status</th>
                <th className="th text-center">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={6} className="td py-8 text-center text-slate-400">Memuat…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={6} className="td py-8 text-center text-slate-400">Belum ada pengajuan WFA</td></tr>
              ) : rows.map(r => (
                <tr key={r.id} className="tr">
                  {canReview && <td className="td">{r.user?.name ?? '—'}</td>}
                  <td className="td">{fmtDate(r.date)}</td>
                  <td className="td max-w-[200px] truncate">{r.reason || '—'}</td>
                  <td className="td text-center">
                    {r.isOverQuota ? <span className="badge-amber">Melebihi Kuota</span> : <span className="badge-muted">Normal</span>}
                  </td>
                  <td className="td text-center"><span className={STATUS_COLOR[r.status]}>{STATUS_LABEL[r.status]}</span></td>
                  <td className="td text-center">
                    <div className="flex gap-1.5 justify-center">
                      {canReview && r.status === 'PENDING' && (
                        <>
                          <button title="Setujui" onClick={() => handleApproveClick(r)} className="w-7 h-7 rounded flex items-center justify-center text-emerald-600 hover:bg-emerald-50">
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
