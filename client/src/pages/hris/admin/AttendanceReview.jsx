import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { hrisApi } from '../../../api'
import { Check, X } from 'lucide-react'

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
const fmtTime = (d) => d ? new Date(d).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '—'

export default function AttendanceReview() {
  const qc = useQueryClient()
  const [rejecting, setRejecting] = useState(null) // { id, note }

  const { data: list, isLoading } = useQuery({
    queryKey: ['hris-attendance-pending-review'],
    queryFn: () => hrisApi.pendingReviewAttendance({ limit: 50 }),
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['hris-attendance-pending-review'] })

  const review = useMutation({
    mutationFn: ({ id, status, reviewNote }) => hrisApi.reviewAttendance(id, { status, reviewNote }),
    onSuccess: () => { toast.success('Presensi direview'); setRejecting(null); invalidate() },
    onError: (e) => toast.error(e.response?.data?.message ?? 'Gagal review'),
  })

  const rows = list?.data ?? []

  return (
    <div className="px-6 py-6 max-w-5xl">
      <div className="mb-5">
        <h1 className="text-lg font-bold text-slate-800">Persetujuan Presensi Lapangan</h1>
        <p className="text-xs text-slate-400 mt-0.5">
          Presensi dengan mode Kerja Lapangan tercatat langsung saat karyawan check-in/out — review ini tidak mengubah jam kerja, hanya menandai sah atau tidaknya klaim.
        </p>
      </div>

      {rejecting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4" onClick={() => setRejecting(null)}>
          <div className="card w-full max-w-sm p-5" onClick={e => e.stopPropagation()}>
            <p className="text-sm font-semibold text-slate-800 mb-1">Tolak Klaim Kerja Lapangan</p>
            <p className="text-xs text-slate-400 mb-3">Jam kerja tetap dihitung normal, ini cuma jadi catatan HR.</p>
            <label className="label">Catatan (opsional)</label>
            <textarea autoFocus className="input mb-3" rows={3} value={rejecting.note} onChange={e => setRejecting(r => ({ ...r, note: e.target.value }))} />
            <div className="flex justify-end gap-2">
              <button onClick={() => setRejecting(null)} className="btn-secondary text-sm">Batal</button>
              <button
                onClick={() => review.mutate({ id: rejecting.id, status: 'REJECTED', reviewNote: rejecting.note || undefined })}
                className="btn-primary text-sm"
              >
                Tolak
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
                <th className="th">Nama</th>
                <th className="th">Tanggal</th>
                <th className="th">Check-in</th>
                <th className="th">Check-out</th>
                <th className="th">Catatan Tujuan</th>
                <th className="th text-center">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={6} className="td py-8 text-center text-slate-400">Memuat…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={6} className="td py-8 text-center text-slate-400">Tidak ada presensi yang menunggu persetujuan</td></tr>
              ) : rows.map(r => (
                <tr key={r.id} className="tr">
                  <td className="td">{r.user?.name ?? '—'}</td>
                  <td className="td">{fmtDate(r.date)}</td>
                  <td className="td">{fmtTime(r.checkInAt)}</td>
                  <td className="td">
                    {fmtTime(r.checkOutAt)}
                    {r.checkOutWorkMode === 'FIELD' && <span className="badge-teal ml-1.5">Checkout Lapangan</span>}
                  </td>
                  <td className="td max-w-[220px] truncate">{r.note || '—'}</td>
                  <td className="td text-center">
                    <div className="flex gap-1.5 justify-center">
                      <button title="Setujui" onClick={() => review.mutate({ id: r.id, status: 'APPROVED' })} className="w-7 h-7 rounded flex items-center justify-center text-emerald-600 hover:bg-emerald-50">
                        <Check size={14} />
                      </button>
                      <button title="Tolak" onClick={() => setRejecting({ id: r.id, note: '' })} className="w-7 h-7 rounded flex items-center justify-center text-red-600 hover:bg-red-50">
                        <X size={14} />
                      </button>
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
