import { useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { hrisApi } from '../../api'
import { useAuth } from '../../context/AuthContext'
import { Plus, X, Check, Ban, Paperclip, FileImage } from 'lucide-react'

const STATUS_LABEL = { PENDING: 'Menunggu', APPROVED: 'Disetujui', REJECTED: 'Ditolak', CANCELLED: 'Dibatalkan' }
const STATUS_COLOR = { PENDING: 'badge-amber', APPROVED: 'badge-green', REJECTED: 'badge-red', CANCELLED: 'badge-muted' }
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

export default function SickLeave() {
  const { hasPermission, user } = useAuth()
  const canReview = hasPermission('hris.attendance.review') || user?.role === 'SUPER_ADMIN' || user?.role === 'COMPANY_ADMIN'
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [reason, setReason] = useState('')
  const [proof, setProof] = useState(null)
  const [attachTargetId, setAttachTargetId] = useState(null)
  const attachInputRef = useRef(null)

  const { data: list, isLoading } = useQuery({ queryKey: ['hris-sick-leave'], queryFn: () => hrisApi.sickLeaveList({ limit: 30 }) })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['hris-sick-leave'] })

  const create = useMutation({
    mutationFn: hrisApi.createSickLeave,
    onSuccess: () => { toast.success('Izin sakit diajukan'); setShowForm(false); setReason(''); setProof(null); invalidate() },
    onError: (e) => toast.error(e.response?.data?.message ?? 'Gagal mengajukan izin sakit'),
  })
  const attach = useMutation({
    mutationFn: ({ id, file }) => hrisApi.attachSickLeaveProof(id, file),
    onSuccess: () => { toast.success('Surat sakit diunggah'); invalidate() },
    onError: (e) => toast.error(e.response?.data?.message ?? 'Gagal mengunggah surat sakit'),
  })
  const review = useMutation({
    mutationFn: ({ id, status }) => hrisApi.reviewSickLeave(id, { status }),
    onSuccess: () => { toast.success('Pengajuan direview'); invalidate() },
    onError: (e) => toast.error(e.response?.data?.message ?? 'Gagal review'),
  })
  const cancel = useMutation({
    mutationFn: hrisApi.cancelSickLeave,
    onSuccess: () => { toast.success('Pengajuan dibatalkan'); invalidate() },
    onError: (e) => toast.error(e.response?.data?.message ?? 'Gagal membatalkan'),
  })

  function pickAttachFile(id) {
    setAttachTargetId(id)
    attachInputRef.current?.click()
  }
  function onAttachFileChange(e) {
    const file = e.target.files?.[0]
    if (file && attachTargetId) attach.mutate({ id: attachTargetId, file })
    e.target.value = ''
  }

  const rows = list?.data ?? []

  return (
    <div className="px-6 py-6 max-w-5xl">
      <input ref={attachInputRef} type="file" accept="image/*" className="hidden" onChange={onAttachFileChange} />

      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-bold text-slate-800">Izin Sakit</h1>
          <p className="text-xs text-slate-400 mt-0.5">Lapor sakit untuk hari ini — alasan wajib diisi, surat sakit boleh menyusul kalau belum sempat difoto</p>
        </div>
        <button onClick={() => setShowForm(v => !v)} className="btn-primary text-sm flex items-center gap-1.5">
          {showForm ? <X size={14} /> : <Plus size={14} />} {showForm ? 'Batal' : 'Lapor Sakit'}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={(e) => { e.preventDefault(); create.mutate({ reason, proof }) }}
          className="card p-5 mb-6 space-y-4"
        >
          <div>
            <label className="label">Alasan</label>
            <textarea required className="input" rows={3} placeholder="Ceritakan singkat kondisimu…" value={reason} onChange={e => setReason(e.target.value)} />
          </div>
          <div>
            <label className="label">Surat Sakit (opsional, boleh menyusul)</label>
            <input type="file" accept="image/*" className="input" onChange={e => setProof(e.target.files?.[0] ?? null)} />
          </div>
          <div className="flex justify-end">
            <button type="submit" disabled={create.isPending} className="btn-primary text-sm">
              {create.isPending ? 'Mengirim…' : 'Kirim Laporan'}
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
                <th className="th">Alasan</th>
                <th className="th text-center">Surat Sakit</th>
                <th className="th text-center">Status</th>
                <th className="th text-center">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={6} className="td py-8 text-center text-slate-400">Memuat…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={6} className="td py-8 text-center text-slate-400">Belum ada laporan sakit</td></tr>
              ) : rows.map(r => (
                <tr key={r.id} className="tr">
                  {canReview && <td className="td">{r.user?.name ?? '—'}</td>}
                  <td className="td">{fmtDate(r.date)}</td>
                  <td className="td max-w-[220px] truncate">{r.reason || '—'}</td>
                  <td className="td text-center">
                    {r.attachmentUrl ? (
                      <a href={r.attachmentUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-brand hover:underline">
                        <FileImage size={13} /> Lihat
                      </a>
                    ) : !canReview && r.status !== 'CANCELLED' ? (
                      <button onClick={() => pickAttachFile(r.id)} className="inline-flex items-center gap-1 text-slate-400 hover:text-brand">
                        <Paperclip size={13} /> Susulkan
                      </button>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
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
