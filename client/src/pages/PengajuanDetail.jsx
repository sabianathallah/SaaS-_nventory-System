import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { requestApi } from '../api'
import { useAuth } from '../context/AuthContext'
import { ArrowLeft, Check, X, Send, RotateCcw, CheckCircle2, Pencil } from 'lucide-react'

const STATUS_LABEL = {
  PENDING:  'Menunggu',
  APPROVED: 'Disetujui',
  REJECTED: 'Ditolak',
  SENT:     'Dikirim',
  DONE:     'Selesai',
}
const STATUS_COLOR = {
  PENDING:  'bg-amber-100 text-amber-700 border-amber-200',
  APPROVED: 'bg-blue-100 text-blue-700 border-blue-200',
  REJECTED: 'bg-red-100 text-red-700 border-red-200',
  SENT:     'bg-purple-100 text-purple-700 border-purple-200',
  DONE:     'bg-emerald-100 text-emerald-700 border-emerald-200',
}
const fmtDate   = (d) => d ? new Date(d).toLocaleDateString('id-ID', { day:'2-digit', month:'short', year:'numeric' }) : '—'
const fmtDt     = (d) => d ? new Date(d).toLocaleString('id-ID', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' }) : '—'

function Field({ label, value }) {
  return (
    <div>
      <div className="text-xs text-slate-400 mb-0.5">{label}</div>
      <div className="text-sm text-slate-700">{value || '—'}</div>
    </div>
  )
}

function RejectModal({ onConfirm, onClose }) {
  const [reason, setReason] = useState('')
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl p-5 w-full max-w-sm">
        <h3 className="font-semibold text-slate-800 mb-3">Alasan Penolakan</h3>
        <textarea value={reason} onChange={e => setReason(e.target.value)}
          placeholder="Tulis alasan penolakan…" rows={3} className="input w-full resize-none mb-3" autoFocus />
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="btn-secondary text-sm">Batal</button>
          <button onClick={() => { if (!reason.trim()) return toast.error('Isi alasan penolakan'); onConfirm(reason) }}
            className="btn-primary text-sm bg-red-600 border-red-600 hover:bg-red-700">Tolak</button>
        </div>
      </div>
    </div>
  )
}

function SentModal({ onConfirm, onClose }) {
  const today = new Date().toISOString().split('T')[0]
  const [sentAt,         setSentAt]         = useState(today)
  const [trackingNumber, setTrackingNumber] = useState('')
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl p-5 w-full max-w-sm">
        <h3 className="font-semibold text-slate-800 mb-3">Tandai Dikirim</h3>
        <div className="space-y-3">
          <div>
            <label className="label mb-1">Tanggal Kirim</label>
            <input type="date" value={sentAt} onChange={e => setSentAt(e.target.value)} className="input w-full" />
          </div>
          <div>
            <label className="label mb-1">No. Resi / Tracking</label>
            <input value={trackingNumber} onChange={e => setTrackingNumber(e.target.value)}
              placeholder="JNE123456, dll (opsional)" className="input w-full" />
          </div>
        </div>
        <div className="flex gap-2 justify-end mt-4">
          <button onClick={onClose} className="btn-secondary text-sm">Batal</button>
          <button onClick={() => onConfirm({ sentAt, trackingNumber })} className="btn-primary text-sm">Simpan</button>
        </div>
      </div>
    </div>
  )
}

function ReturnModal({ onConfirm, onClose }) {
  const today = new Date().toISOString().split('T')[0]
  const [returnedAt, setReturnedAt] = useState(today)
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl p-5 w-full max-w-sm">
        <h3 className="font-semibold text-slate-800 mb-3">Tandai Dikembalikan</h3>
        <div>
          <label className="label mb-1">Tanggal Kembali</label>
          <input type="date" value={returnedAt} onChange={e => setReturnedAt(e.target.value)} className="input w-full" />
        </div>
        <div className="flex gap-2 justify-end mt-4">
          <button onClick={onClose} className="btn-secondary text-sm">Batal</button>
          <button onClick={() => onConfirm({ returnedAt })} className="btn-primary text-sm">Simpan</button>
        </div>
      </div>
    </div>
  )
}

export default function PengajuanDetail() {
  const { id }     = useParams()
  const navigate   = useNavigate()
  const qc         = useQueryClient()
  const { user, hasPermission } = useAuth()

  const [showReject,  setShowReject]  = useState(false)
  const [showSent,    setShowSent]    = useState(false)
  const [showReturn,  setShowReturn]  = useState(false)

  const { data: req, isLoading, error } = useQuery({
    queryKey: ['request', id],
    queryFn:  () => requestApi.get(id),
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['request', id] })

  const approve      = useMutation({ mutationFn: () => requestApi.approve(id),               onSuccess: invalidate, onError: e => toast.error(e.response?.data?.message ?? 'Gagal') })
  const reject       = useMutation({ mutationFn: (reason) => requestApi.reject(id, reason),  onSuccess: invalidate, onError: e => toast.error(e.response?.data?.message ?? 'Gagal') })
  const markSent     = useMutation({ mutationFn: (d) => requestApi.markSent(id, d),           onSuccess: invalidate, onError: e => toast.error(e.response?.data?.message ?? 'Gagal') })
  const markReturned = useMutation({ mutationFn: (d) => requestApi.markReturned(id, d),       onSuccess: invalidate, onError: e => toast.error(e.response?.data?.message ?? 'Gagal') })
  const markDone     = useMutation({ mutationFn: () => requestApi.markDone(id),               onSuccess: invalidate, onError: e => toast.error(e.response?.data?.message ?? 'Gagal') })
  const destroy      = useMutation({ mutationFn: () => requestApi.destroy(id),               onSuccess: () => navigate('/pengajuan'), onError: e => toast.error(e.response?.data?.message ?? 'Gagal') })

  const canProcess = hasPermission('request.process') || hasPermission('request.manage') ||
                     user?.role === 'SUPER_ADMIN' || user?.role === 'COMPANY_ADMIN'
  const isOwn      = req?.requestorId === user?.id
  const canEdit    = req?.status === 'PENDING' && (isOwn || canProcess)
  const canDelete  = canEdit

  if (isLoading) return <div className="px-6 py-6 text-sm text-slate-400">Memuat…</div>
  if (error)     return <div className="px-6 py-6 text-sm text-red-500">Gagal memuat data</div>
  if (!req)      return null

  const skuVariantLabel = (item) =>
    item.sku ? (item.sku.ProductVariantOptions ?? []).map(v => v.value).join(' / ') : item.variantLabel

  return (
    <div className="px-6 py-6 max-w-2xl">
      {showReject  && <RejectModal  onClose={() => setShowReject(false)}  onConfirm={(r) => { reject.mutate(r); setShowReject(false) }} />}
      {showSent    && <SentModal    onClose={() => setShowSent(false)}    onConfirm={(d) => { markSent.mutate(d); setShowSent(false) }} />}
      {showReturn  && <ReturnModal  onClose={() => setShowReturn(false)}  onConfirm={(d) => { markReturned.mutate(d); setShowReturn(false) }} />}

      <button onClick={() => navigate('/pengajuan')} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-4">
        <ArrowLeft size={14} /> Semua Pengajuan
      </button>

      {/* Header */}
      <div className="flex items-start justify-between mb-5 flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-lg font-bold text-slate-800">Pengajuan #{req.id}</h1>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${STATUS_COLOR[req.status]}`}>
              {STATUS_LABEL[req.status]}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">{req.requestType?.name} · Dibuat {fmtDt(req.createdAt)}</p>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 flex-wrap">
          {canEdit && (
            <Link to={`/pengajuan/${req.id}/edit`}
              className="btn-secondary text-xs flex items-center gap-1">
              <Pencil size={11} /> Edit
            </Link>
          )}
          {canDelete && (
            <button onClick={() => { if (confirm('Hapus pengajuan ini?')) destroy.mutate() }}
              className="btn-secondary text-xs text-red-500 border-red-200 hover:bg-red-50 flex items-center gap-1">
              <X size={11} /> Hapus
            </button>
          )}

          {canProcess && req.status === 'PENDING' && (
            <>
              <button onClick={() => approve.mutate()}
                className="btn-primary text-xs flex items-center gap-1 bg-emerald-600 border-emerald-600 hover:bg-emerald-700">
                <Check size={11} /> Setujui
              </button>
              <button onClick={() => setShowReject(true)}
                className="btn-secondary text-xs text-red-500 border-red-200 hover:bg-red-50 flex items-center gap-1">
                <X size={11} /> Tolak
              </button>
            </>
          )}

          {canProcess && req.status === 'APPROVED' && (
            <>
              <button onClick={() => setShowSent(true)}
                className="btn-primary text-xs flex items-center gap-1">
                <Send size={11} /> Tandai Dikirim
              </button>
              <button onClick={() => setShowReject(true)}
                className="btn-secondary text-xs text-red-500 border-red-200 hover:bg-red-50 flex items-center gap-1">
                <X size={11} /> Tolak
              </button>
            </>
          )}

          {canProcess && req.status === 'SENT' && (
            <>
              {req.needsReturn && !req.returnedAt && (
                <button onClick={() => setShowReturn(true)}
                  className="btn-secondary text-xs flex items-center gap-1">
                  <RotateCcw size={11} /> Tandai Kembali
                </button>
              )}
              <button onClick={() => { if (confirm('Tandai selesai?')) markDone.mutate() }}
                className="btn-primary text-xs flex items-center gap-1 bg-emerald-600 border-emerald-600 hover:bg-emerald-700">
                <CheckCircle2 size={11} /> Selesaikan
              </button>
            </>
          )}
        </div>
      </div>

      {/* Rejection reason */}
      {req.status === 'REJECTED' && req.rejectionReason && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-4 text-sm text-red-700">
          <span className="font-medium">Alasan ditolak: </span>{req.rejectionReason}
        </div>
      )}

      {/* Main info */}
      <div className="card p-4 mb-4">
        <h2 className="text-sm font-semibold text-slate-600 mb-3 border-b border-slate-100 pb-2">Detail Pengajuan</h2>
        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
          <Field label="Pengaju"        value={req.requestor?.name} />
          <Field label="Divisi"         value={req.divisi} />
          <Field label="Penerima"       value={req.recipientName} />
          <Field label="Tanggal Butuh"  value={fmtDate(req.neededAt)} />
          <div className="col-span-2">
            <Field label="Alamat Pengiriman" value={req.recipientAddress} />
          </div>
          <div className="col-span-2">
            <Field label="Catatan" value={req.note} />
          </div>
          <Field label="Perlu Dikembalikan" value={req.needsReturn ? 'Ya' : 'Tidak'} />
          {req.processedBy && <Field label="Diproses oleh" value={req.processor?.name} />}
        </div>
      </div>

      {/* Shipping info */}
      {(req.sentAt || req.trackingNumber || req.returnedAt) && (
        <div className="card p-4 mb-4">
          <h2 className="text-sm font-semibold text-slate-600 mb-3 border-b border-slate-100 pb-2">Info Pengiriman</h2>
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            <Field label="Tanggal Kirim"    value={fmtDate(req.sentAt)} />
            <Field label="No. Resi / Kode"  value={req.trackingNumber} />
            {req.needsReturn && <Field label="Tanggal Kembali" value={fmtDate(req.returnedAt)} />}
          </div>
        </div>
      )}

      {/* Items */}
      <div className="card p-4">
        <h2 className="text-sm font-semibold text-slate-600 mb-3 border-b border-slate-100 pb-2">
          Produk ({req.items?.length ?? 0} item)
        </h2>
        <div className="space-y-2">
          {(req.items ?? []).map((item, i) => {
            const vLabel = skuVariantLabel(item)
            return (
              <div key={item.id} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2.5">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-slate-700 truncate">
                    {item.sku?.Product?.name ?? item.productName}
                  </div>
                  {vLabel && <div className="text-xs text-slate-400 mt-0.5">{vLabel}</div>}
                  {item.note && <div className="text-xs text-slate-400 italic">{item.note}</div>}
                </div>
                <div className="text-sm font-semibold text-indigo-600 ml-3 flex-shrink-0">×{item.qty}</div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
