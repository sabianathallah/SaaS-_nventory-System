import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { hrisApi } from '../../../api'
import { Check, X } from 'lucide-react'

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
const fmtTime = (d) => d ? new Date(d).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '—'

export default function AttendanceReview() {
  const qc = useQueryClient()
  const [rejecting, setRejecting] = useState(null) // { id, note, kind: 'field' | 'late' }
  const [approvingField, setApprovingField] = useState(null) // { id, atVendor: bool, score: string }

  const { data: list, isLoading } = useQuery({
    queryKey: ['hris-attendance-pending-review'],
    queryFn: () => hrisApi.pendingReviewAttendance({ limit: 50 }),
  })
  const { data: lateExcuses, isLoading: loadingLateExcuses } = useQuery({
    queryKey: ['hris-late-excuse-pending'],
    queryFn: () => hrisApi.lateExcuseList({ status: 'PENDING', limit: 50 }),
  })

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['hris-attendance-pending-review'] })
    qc.invalidateQueries({ queryKey: ['hris-late-excuse-pending'] })
  }

  const reviewField = useMutation({
    mutationFn: ({ id, status, reviewNote, fieldScore }) => hrisApi.reviewAttendance(id, { status, reviewNote, fieldScore }),
    onSuccess: () => { toast.success('Presensi direview'); setRejecting(null); setApprovingField(null); invalidate() },
    onError: (e) => toast.error(e.response?.data?.message ?? 'Gagal review'),
  })
  const reviewLateAttendance = useMutation({
    mutationFn: ({ id, status, reviewNote }) => hrisApi.reviewLateAttendance(id, { status, reviewNote }),
    onSuccess: () => { toast.success('Keterlambatan direview'); setRejecting(null); invalidate() },
    onError: (e) => toast.error(e.response?.data?.message ?? 'Gagal review'),
  })
  const reviewLateExcuse = useMutation({
    mutationFn: ({ id, status }) => hrisApi.reviewLateExcuse(id, { status }),
    onSuccess: () => { toast.success('Pengajuan izin telat direview'); invalidate() },
    onError: (e) => toast.error(e.response?.data?.message ?? 'Gagal review'),
  })
  const reviewEarlyLeave = useMutation({
    mutationFn: ({ id, status, reviewNote }) => hrisApi.reviewEarlyLeave(id, { status, reviewNote }),
    onSuccess: () => { toast.success('Pulang cepat direview'); setRejecting(null); invalidate() },
    onError: (e) => toast.error(e.response?.data?.message ?? 'Gagal review'),
  })

  function submitApproveField() {
    if (approvingField.atVendor) {
      reviewField.mutate({ id: approvingField.id, status: 'APPROVED' })
      return
    }
    const score = Number(approvingField.score)
    if (!Number.isInteger(score) || score < 0 || score > 100) {
      toast.error('Skor harus angka bulat 0–100')
      return
    }
    reviewField.mutate({ id: approvingField.id, status: 'APPROVED', fieldScore: score })
  }

  function submitReject() {
    if (rejecting.kind === 'field') reviewField.mutate({ id: rejecting.id, status: 'REJECTED', reviewNote: rejecting.note || undefined })
    else if (rejecting.kind === 'early') reviewEarlyLeave.mutate({ id: rejecting.id, status: 'REJECTED', reviewNote: rejecting.note || undefined })
    else reviewLateAttendance.mutate({ id: rejecting.id, status: 'REJECTED', reviewNote: rejecting.note || undefined })
  }

  const rows = list?.data ?? []
  const excuseRows = lateExcuses?.data ?? []

  return (
    <div className="px-6 py-6 max-w-5xl">
      <div className="mb-5">
        <h1 className="text-lg font-bold text-slate-800">Persetujuan Presensi</h1>
        <p className="text-xs text-slate-400 mt-0.5">
          Review klaim Kerja Lapangan, keterlambatan dadakan, pulang cepat, dan pengajuan izin telat di muka. Approve/reject tidak mengubah jam yang sudah tercatat, kecuali izin telat yang disetujui (jadi Hadir).
        </p>
      </div>

      {approvingField && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4" onClick={() => setApprovingField(null)}>
          <div className="card w-full max-w-sm p-5" onClick={e => e.stopPropagation()}>
            <p className="text-sm font-semibold text-slate-800 mb-1">Setujui Klaim Kerja Lapangan</p>
            <p className="text-xs text-slate-400 mb-3">Posisi karyawan saat absen menentukan poin leaderboard hari itu.</p>
            <div className="space-y-2 mb-3">
              <label className={`flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer ${approvingField.atVendor ? 'border-emerald-300 bg-emerald-50/50' : 'border-slate-200'}`}>
                <input type="radio" className="mt-0.5" checked={approvingField.atVendor} onChange={() => setApprovingField(a => ({ ...a, atVendor: true }))} />
                <span>
                  <span className="block text-sm font-medium text-slate-700">Sudah di lokasi vendor</span>
                  <span className="block text-[11px] text-slate-400">Poin dihitung penuh seperti hadir biasa</span>
                </span>
              </label>
              <label className={`flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer ${!approvingField.atVendor ? 'border-amber-300 bg-amber-50/50' : 'border-slate-200'}`}>
                <input type="radio" className="mt-0.5" checked={!approvingField.atVendor} onChange={() => setApprovingField(a => ({ ...a, atVendor: false }))} />
                <span>
                  <span className="block text-sm font-medium text-slate-700">Belum sampai vendor / masih di jalan</span>
                  <span className="block text-[11px] text-slate-400">Poin leaderboard hari ini ditentukan manual</span>
                </span>
              </label>
            </div>
            {!approvingField.atVendor && (
              <div className="mb-3">
                <label className="label">Poin (0–100)</label>
                <div className="flex items-center gap-1.5 mb-2">
                  {[100, 75, 50, 25].map(v => (
                    <button key={v} type="button" onClick={() => setApprovingField(a => ({ ...a, score: String(v) }))}
                      className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${approvingField.score === String(v) ? 'bg-brand text-white border-brand' : 'text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
                      {v}
                    </button>
                  ))}
                </div>
                <input type="number" min="0" max="100" className="input w-28" value={approvingField.score}
                  onChange={e => setApprovingField(a => ({ ...a, score: e.target.value }))} />
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button onClick={() => setApprovingField(null)} className="btn-secondary text-sm">Batal</button>
              <button onClick={submitApproveField} disabled={reviewField.isPending} className="btn-primary text-sm">
                {reviewField.isPending ? 'Menyimpan…' : 'Setujui'}
              </button>
            </div>
          </div>
        </div>
      )}

      {rejecting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4" onClick={() => setRejecting(null)}>
          <div className="card w-full max-w-sm p-5" onClick={e => e.stopPropagation()}>
            <p className="text-sm font-semibold text-slate-800 mb-1">
              {rejecting.kind === 'field' ? 'Tolak Klaim Kerja Lapangan' : rejecting.kind === 'early' ? 'Tolak Alasan Pulang Cepat' : 'Tolak Alasan Keterlambatan'}
            </p>
            <p className="text-xs text-slate-400 mb-3">Jam kerja/status tetap seperti tercatat, ini cuma jadi catatan HR.</p>
            <label className="label">Catatan (opsional)</label>
            <textarea autoFocus className="input mb-3" rows={3} value={rejecting.note} onChange={e => setRejecting(r => ({ ...r, note: e.target.value }))} />
            <div className="flex justify-end gap-2">
              <button onClick={() => setRejecting(null)} className="btn-secondary text-sm">Batal</button>
              <button onClick={submitReject} className="btn-primary text-sm">Tolak</button>
            </div>
          </div>
        </div>
      )}

      <div className="card overflow-hidden mb-6">
        <div className="px-4 py-3 border-b border-slate-100"><p className="text-sm font-semibold text-slate-700">Izin Telat — Pengajuan Menunggu</p></div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="th">Nama</th>
                <th className="th">Tanggal</th>
                <th className="th">Perkiraan Jam</th>
                <th className="th">Alasan</th>
                <th className="th text-center">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loadingLateExcuses ? (
                <tr><td colSpan={5} className="td py-6 text-center text-slate-400">Memuat…</td></tr>
              ) : excuseRows.length === 0 ? (
                <tr><td colSpan={5} className="td py-6 text-center text-slate-400">Tidak ada pengajuan izin telat</td></tr>
              ) : excuseRows.map(r => (
                <tr key={r.id} className="tr">
                  <td className="td">{r.user?.name ?? '—'}</td>
                  <td className="td">{fmtDate(r.date)}</td>
                  <td className="td">{r.expectedTime || '—'}</td>
                  <td className="td max-w-[220px] truncate">{r.reason || '—'}</td>
                  <td className="td text-center">
                    <div className="flex gap-1.5 justify-center">
                      <button title="Setujui" onClick={() => reviewLateExcuse.mutate({ id: r.id, status: 'APPROVED' })} className="w-7 h-7 rounded flex items-center justify-center text-emerald-600 hover:bg-emerald-50">
                        <Check size={14} />
                      </button>
                      <button title="Tolak" onClick={() => reviewLateExcuse.mutate({ id: r.id, status: 'REJECTED' })} className="w-7 h-7 rounded flex items-center justify-center text-red-600 hover:bg-red-50">
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

      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100"><p className="text-sm font-semibold text-slate-700">Kerja Lapangan, Keterlambatan Dadakan & Pulang Cepat</p></div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="th">Nama</th>
                <th className="th">Tanggal</th>
                <th className="th">Check-in</th>
                <th className="th">Check-out</th>
                <th className="th">Catatan</th>
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
                  <td className="td">
                    {fmtTime(r.checkInAt)}
                    {r.lateExcuseStatus === 'PENDING_REVIEW' && <span className="badge-amber ml-1.5">Terlambat</span>}
                  </td>
                  <td className="td">
                    {fmtTime(r.checkOutAt)}
                    {r.checkOutWorkMode === 'FIELD' && <span className="badge-teal ml-1.5">Checkout Lapangan</span>}
                    {r.earlyLeaveStatus === 'PENDING_REVIEW' && <span className="badge-amber ml-1.5">Pulang Cepat</span>}
                  </td>
                  <td className="td max-w-[220px]">
                    <div className="truncate">{r.lateExcuseStatus === 'PENDING_REVIEW' ? (r.lateExcuseReason || '—') : (r.note || '—')}</div>
                    {r.earlyLeaveStatus === 'PENDING_REVIEW' && r.earlyLeaveReason && (
                      <div className="truncate text-[11px] text-amber-700">Pulang cepat: {r.earlyLeaveReason}</div>
                    )}
                  </td>
                  <td className="td text-center">
                    <div className="flex flex-col gap-1.5 items-center">
                      {r.reviewStatus === 'PENDING_REVIEW' && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-slate-400">Lapangan:</span>
                          <button title="Setujui" onClick={() => setApprovingField({ id: r.id, atVendor: true, score: '75' })} className="w-6 h-6 rounded flex items-center justify-center text-emerald-600 hover:bg-emerald-50">
                            <Check size={13} />
                          </button>
                          <button title="Tolak" onClick={() => setRejecting({ id: r.id, note: '', kind: 'field' })} className="w-6 h-6 rounded flex items-center justify-center text-red-600 hover:bg-red-50">
                            <X size={13} />
                          </button>
                        </div>
                      )}
                      {r.lateExcuseStatus === 'PENDING_REVIEW' && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-slate-400">Telat:</span>
                          <button title="Setujui" onClick={() => reviewLateAttendance.mutate({ id: r.id, status: 'APPROVED' })} className="w-6 h-6 rounded flex items-center justify-center text-emerald-600 hover:bg-emerald-50">
                            <Check size={13} />
                          </button>
                          <button title="Tolak" onClick={() => setRejecting({ id: r.id, note: '', kind: 'late' })} className="w-6 h-6 rounded flex items-center justify-center text-red-600 hover:bg-red-50">
                            <X size={13} />
                          </button>
                        </div>
                      )}
                      {r.earlyLeaveStatus === 'PENDING_REVIEW' && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-slate-400">Pulang Cepat:</span>
                          <button title="Maklumi" onClick={() => reviewEarlyLeave.mutate({ id: r.id, status: 'APPROVED' })} className="w-6 h-6 rounded flex items-center justify-center text-emerald-600 hover:bg-emerald-50">
                            <Check size={13} />
                          </button>
                          <button title="Tolak" onClick={() => setRejecting({ id: r.id, note: '', kind: 'early' })} className="w-6 h-6 rounded flex items-center justify-center text-red-600 hover:bg-red-50">
                            <X size={13} />
                          </button>
                        </div>
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
