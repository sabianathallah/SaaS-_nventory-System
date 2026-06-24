import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { requestApi, requestTypeApi } from '../api'
import { useAuth } from '../context/AuthContext'
import { ArrowLeft, Check, X, Send, RotateCcw, CheckCircle2, Pencil, Save, PackageCheck } from 'lucide-react'

const STATUS_LABEL = { PENDING:'Menunggu', APPROVED:'Disetujui', REJECTED:'Ditolak', SENT:'Dikirim', DONE:'Selesai' }
const STATUS_COLOR = {
  PENDING:  'bg-amber-100 text-amber-700 border-amber-200',
  APPROVED: 'bg-blue-100 text-blue-700 border-blue-200',
  REJECTED: 'bg-red-100 text-red-700 border-red-200',
  SENT:     'bg-purple-100 text-purple-700 border-purple-200',
  DONE:     'bg-emerald-100 text-emerald-700 border-emerald-200',
}
const STEPS_NORMAL  = ['PENDING','APPROVED','SENT','DONE']
const STEPS_RETURN  = ['PENDING','APPROVED','SENT','RETURNED','DONE']
const STEP_LABEL = { PENDING:'Menunggu', APPROVED:'Disetujui', SENT:'Dikirim', RETURNED:'Dikembalikan', DONE:'Selesai' }

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('id-ID', { day:'2-digit', month:'short', year:'numeric' }) : '—'
const fmtDt   = (d) => d ? new Date(d).toLocaleString ('id-ID', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' }) : '—'

function Field({ label, value }) {
  return (
    <div>
      <div className="text-xs text-slate-400 mb-0.5">{label}</div>
      <div className="text-sm text-slate-700 font-medium">{value || '—'}</div>
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

function SentModal({ onConfirm, onClose, items }) {
  const today = new Date().toISOString().split('T')[0]
  const [sentAt, setSentAt]                 = useState(today)
  const [trackingNumber, setTrackingNumber] = useState('')
  const [shippingNote, setShippingNote]     = useState('')
  const [itemQtys, setItemQtys]            = useState(() =>
    Object.fromEntries((items ?? []).map(i => [i.id, i.qty]))
  )
  const isPartial = (items ?? []).some(i => Number(itemQtys[i.id] ?? i.qty) < i.qty)

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl p-5 w-full max-w-md">
        <h3 className="font-semibold text-slate-800 mb-3">Tandai Dikirim</h3>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label mb-1">Tanggal Kirim</label>
              <input type="date" value={sentAt} onChange={e => setSentAt(e.target.value)} className="input w-full" />
            </div>
            <div>
              <label className="label mb-1">No. Resi (opsional)</label>
              <input value={trackingNumber} onChange={e => setTrackingNumber(e.target.value)}
                placeholder="JNE123456" className="input w-full" />
            </div>
          </div>

          {/* Per-item shipped qty */}
          {(items ?? []).length > 0 && (
            <div>
              <label className="label mb-1.5">Qty dikirim per item</label>
              <div className="space-y-1.5">
                {(items ?? []).map(item => (
                  <div key={item.id} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2">
                    <div className="text-sm text-slate-700 truncate flex-1 min-w-0">
                      {item.sku?.Product?.name ?? item.productName}
                      {item.variantLabel && <span className="text-slate-400 ml-1">· {item.variantLabel}</span>}
                    </div>
                    <div className="flex items-center gap-1.5 ml-3 flex-shrink-0">
                      <input
                        type="number" min={0} max={item.qty}
                        value={itemQtys[item.id] ?? item.qty}
                        onChange={e => setItemQtys(q => ({ ...q, [item.id]: Math.min(item.qty, Math.max(0, Number(e.target.value))) }))}
                        className="input w-14 text-center text-sm py-1"
                      />
                      <span className="text-xs text-slate-400">/ {item.qty}</span>
                    </div>
                  </div>
                ))}
              </div>
              {isPartial && (
                <p className="text-xs text-amber-600 mt-1.5">⚠ Pengiriman sebagian — sisa item akan tercatat sebagai hutang stok</p>
              )}
            </div>
          )}

          <div>
            <label className="label mb-1">Catatan Pengiriman (opsional)</label>
            <textarea value={shippingNote} onChange={e => setShippingNote(e.target.value)}
              placeholder="Contoh: sisa 1 item menyusul minggu depan…"
              rows={2} className="input w-full resize-none text-sm" />
          </div>
        </div>
        <div className="flex gap-2 justify-end mt-4">
          <button onClick={onClose} className="btn-secondary text-sm">Batal</button>
          <button onClick={() => onConfirm({
            sentAt, trackingNumber,
            shippingNote: shippingNote.trim() || null,
            items: (items ?? []).map(i => ({ id: i.id, shippedQty: Number(itemQtys[i.id] ?? i.qty) })),
          })} className="btn-primary text-sm">Simpan</button>
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

function StatusStepper({ status, needsReturn, returnedAt }) {
  if (status === 'REJECTED') return (
    <div className="flex items-center gap-2 mb-5 p-3 bg-red-50 border border-red-200 rounded-xl">
      <span className="w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center flex-shrink-0">
        <X size={12} />
      </span>
      <span className="text-sm font-medium text-red-700">Pengajuan Ditolak</span>
    </div>
  )

  const steps = needsReturn ? STEPS_RETURN : STEPS_NORMAL

  // Map logical status → virtual index
  let currentIdx
  if (!needsReturn) {
    currentIdx = STEPS_NORMAL.indexOf(status)
  } else {
    if      (status === 'PENDING')                        currentIdx = 0
    else if (status === 'APPROVED')                       currentIdx = 1
    else if (status === 'SENT' && !returnedAt)            currentIdx = 2
    else if (status === 'SENT' && returnedAt)             currentIdx = 3
    else if (status === 'DONE')                           currentIdx = 4
    else                                                  currentIdx = 0
  }

  return (
    <div className="flex items-center gap-0 mb-5 overflow-x-auto pb-1">
      {steps.map((step, idx) => {
        const done   = idx < currentIdx
        const active = idx === currentIdx
        return (
          <div key={step} className="flex items-center min-w-0">
            <div className="flex flex-col items-center flex-shrink-0">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                done   ? 'bg-emerald-500 text-white' :
                active ? 'bg-indigo-600 text-white ring-4 ring-indigo-100' :
                         'bg-slate-200 text-slate-400'
              }`}>
                {done ? <Check size={13} /> : idx + 1}
              </div>
              <span className={`text-[10px] mt-1 font-medium whitespace-nowrap ${
                active ? 'text-indigo-600' : done ? 'text-emerald-600' : 'text-slate-400'
              }`}>{STEP_LABEL[step]}</span>
            </div>
            {idx < steps.length - 1 && (
              <div className={`h-0.5 w-10 sm:w-16 mx-1 flex-shrink-0 ${idx < currentIdx ? 'bg-emerald-400' : 'bg-slate-200'}`} />
            )}
          </div>
        )
      })}
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
  const [editing,     setEditing]     = useState(false)
  const [form,        setForm]        = useState(null)

  const { data: types } = useQuery({ queryKey: ['request-types'], queryFn: requestTypeApi.list })

  const { data: req, isLoading, error } = useQuery({
    queryKey: ['request', id],
    queryFn:  () => requestApi.get(id),
  })

  useEffect(() => {
    if (req && !form) setForm({
      requestTypeId:    req.requestTypeId    ?? '',
      recipientName:    req.recipientName    ?? '',
      recipientAddress: req.recipientAddress ?? '',
      neededAt:         req.neededAt ? req.neededAt.split('T')[0] : '',
      divisi:           req.divisi           ?? '',
      note:             req.note             ?? '',
      needsReturn:      req.needsReturn      ?? false,
    })
  }, [req])

  const invalidate = () => qc.invalidateQueries({ queryKey: ['request', id] })

  const approve      = useMutation({ mutationFn: () => requestApi.approve(id),               onSuccess: invalidate, onError: e => toast.error(e.response?.data?.message ?? 'Gagal') })
  const reject       = useMutation({ mutationFn: (r) => requestApi.reject(id, r),            onSuccess: invalidate, onError: e => toast.error(e.response?.data?.message ?? 'Gagal') })
  const markSent     = useMutation({ mutationFn: (d) => requestApi.markSent(id, d),           onSuccess: invalidate, onError: e => toast.error(e.response?.data?.message ?? 'Gagal') })
  const markReturned = useMutation({ mutationFn: (d) => requestApi.markReturned(id, d),        onSuccess: invalidate, onError: e => toast.error(e.response?.data?.message ?? 'Gagal') })
  const shipRemaining = useMutation({ mutationFn: () => requestApi.shipRemaining(id),          onSuccess: invalidate, onError: e => toast.error(e.response?.data?.message ?? 'Gagal') })
  const markDone     = useMutation({ mutationFn: () => requestApi.markDone(id),                onSuccess: invalidate, onError: e => toast.error(e.response?.data?.message ?? 'Gagal') })
  const destroy      = useMutation({ mutationFn: () => requestApi.destroy(id),               onSuccess: () => navigate('/pengajuan'), onError: e => toast.error(e.response?.data?.message ?? 'Gagal') })

  const saveEdit = useMutation({
    mutationFn: () => requestApi.update(id, form),
    onSuccess: () => { invalidate(); setEditing(false); toast.success('Pengajuan diperbarui') },
    onError: e => toast.error(e.response?.data?.message ?? 'Gagal menyimpan'),
  })

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

  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }))

  return (
    <div className="px-6 py-6 max-w-2xl">
      {showReject  && <RejectModal  onClose={() => setShowReject(false)}  onConfirm={(r) => { reject.mutate(r); setShowReject(false) }} />}
      {showSent    && <SentModal    onClose={() => setShowSent(false)}    onConfirm={(d) => { markSent.mutate(d); setShowSent(false) }} items={req?.items ?? []} />}
      {showReturn  && <ReturnModal  onClose={() => setShowReturn(false)}  onConfirm={(d) => { markReturned.mutate(d); setShowReturn(false) }} />}

      <button onClick={() => navigate('/pengajuan')} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-4">
        <ArrowLeft size={14} /> Semua Pengajuan
      </button>

      {/* Status stepper */}
      <StatusStepper status={req.status} needsReturn={req.needsReturn} returnedAt={req.returnedAt} />

      {/* Header */}
      <div className="flex items-start justify-between mb-4 flex-wrap gap-3">
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
          {canEdit && !editing && (
            <button onClick={() => setEditing(true)}
              className="btn-secondary text-xs flex items-center gap-1">
              <Pencil size={11} /> Edit
            </button>
          )}
          {editing && (
            <>
              <button onClick={() => { setEditing(false); setForm({ requestTypeId: req.requestTypeId ?? '', recipientName: req.recipientName ?? '', recipientAddress: req.recipientAddress ?? '', neededAt: req.neededAt ? req.neededAt.split('T')[0] : '', divisi: req.divisi ?? '', note: req.note ?? '', needsReturn: req.needsReturn ?? false }) }}
                className="btn-secondary text-xs flex items-center gap-1">
                <X size={11} /> Batal
              </button>
              <button onClick={() => saveEdit.mutate()} disabled={saveEdit.isPending}
                className="btn-primary text-xs flex items-center gap-1">
                <Save size={11} /> {saveEdit.isPending ? 'Menyimpan…' : 'Simpan'}
              </button>
            </>
          )}
          {canDelete && !editing && (
            <button onClick={() => { if (confirm('Hapus pengajuan ini?')) destroy.mutate() }}
              className="btn-secondary text-xs text-red-500 border-red-200 hover:bg-red-50 flex items-center gap-1">
              <X size={11} /> Hapus
            </button>
          )}

          {canProcess && req.status === 'PENDING' && !editing && (
            <>
              <button onClick={() => approve.mutate()} disabled={approve.isPending}
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

          {canProcess && req.status === 'SENT' && (() => {
            const hasDebt = (req.items ?? []).some(i => i.shippedQty !== null && i.shippedQty < i.qty)
            return (
              <>
                {hasDebt && (
                  <button onClick={() => { if (confirm('Tandai semua sisa item sebagai sudah dikirim?')) shipRemaining.mutate() }}
                    disabled={shipRemaining.isPending}
                    className="btn-primary text-xs flex items-center gap-1 bg-indigo-500 border-indigo-500 hover:bg-indigo-600">
                    <PackageCheck size={11} /> Kirim Sisa
                  </button>
                )}
                {req.needsReturn && !req.returnedAt && (
                  <button onClick={() => setShowReturn(true)}
                    className="btn-primary text-xs flex items-center gap-1 bg-amber-500 border-amber-500 hover:bg-amber-600">
                    <RotateCcw size={11} /> Tandai Dikembalikan
                  </button>
                )}
                {!hasDebt && (!req.needsReturn || req.returnedAt) && (
                  <button onClick={() => { if (confirm('Tandai selesai?')) markDone.mutate() }}
                    className="btn-primary text-xs flex items-center gap-1 bg-emerald-600 border-emerald-600 hover:bg-emerald-700">
                    <CheckCircle2 size={11} /> Selesaikan
                  </button>
                )}
              </>
            )
          })()}
        </div>
      </div>

      {/* Rejection reason */}
      {req.status === 'REJECTED' && req.rejectionReason && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-4 text-sm text-red-700">
          <span className="font-medium">Alasan ditolak: </span>{req.rejectionReason}
        </div>
      )}

      {/* Main info — read or edit mode */}
      <div className="card p-4 mb-4">
        <h2 className="text-sm font-semibold text-slate-600 mb-3 border-b border-slate-100 pb-2">Detail Pengajuan</h2>
        {editing && form ? (
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            <div>
              <label className="label mb-1">Jenis Pengajuan</label>
              <select value={form.requestTypeId} onChange={e => setF('requestTypeId', e.target.value)} className="input w-full text-sm">
                <option value="">— Pilih —</option>
                {(types ?? []).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label mb-1">Divisi</label>
              <input value={form.divisi} onChange={e => setF('divisi', e.target.value)} className="input w-full text-sm" />
            </div>
            <div>
              <label className="label mb-1">Nama Penerima</label>
              <input value={form.recipientName} onChange={e => setF('recipientName', e.target.value)} className="input w-full text-sm" />
            </div>
            <div>
              <label className="label mb-1">Tanggal Butuh</label>
              <input type="date" value={form.neededAt} onChange={e => setF('neededAt', e.target.value)} className="input w-full text-sm" />
            </div>
            <div className="col-span-2">
              <label className="label mb-1">Alamat Pengiriman</label>
              <textarea value={form.recipientAddress} onChange={e => setF('recipientAddress', e.target.value)}
                rows={2} className="input w-full text-sm resize-none" />
            </div>
            <div className="col-span-2">
              <label className="label mb-1">Catatan</label>
              <input value={form.note} onChange={e => setF('note', e.target.value)} className="input w-full text-sm" />
            </div>
            <div className="flex items-center gap-2 col-span-2">
              <input type="checkbox" id="needsReturn" checked={form.needsReturn}
                onChange={e => setF('needsReturn', e.target.checked)} className="w-4 h-4" />
              <label htmlFor="needsReturn" className="text-sm text-slate-700">Perlu dikembalikan</label>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            <Field label="Pengaju"        value={req.requestor?.name} />
            <Field label="Divisi"         value={req.divisi} />
            <Field label="Penerima"       value={req.recipientName} />
            <Field label="Tanggal Butuh"  value={fmtDate(req.neededAt)} />
            <div className="col-span-2">
              <Field label="Alamat Pengiriman" value={req.recipientAddress} />
            </div>
            {req.note && (
              <div className="col-span-2">
                <Field label="Catatan" value={req.note} />
              </div>
            )}
            <Field label="Perlu Dikembalikan" value={req.needsReturn ? 'Ya' : 'Tidak'} />
            {req.processor && <Field label="Diproses oleh" value={req.processor?.name} />}
          </div>
        )}
      </div>

      {/* Shipping info — always show when status SENT/DONE or has data */}
      {(req.status === 'SENT' || req.status === 'DONE' || req.sentAt || req.trackingNumber || req.returnedAt) && (
        <div className={`card p-4 mb-4 border-l-4 ${req.status === 'DONE' ? 'border-l-emerald-400' : 'border-l-purple-400'}`}>
          <h2 className="text-sm font-semibold text-slate-600 mb-3 border-b border-slate-100 pb-2 flex items-center gap-2">
            <Send size={13} className="text-purple-500" /> Info Pengiriman
          </h2>
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            <Field label="Tanggal Kirim"    value={fmtDate(req.sentAt)} />
            <Field label="No. Resi / Kode"  value={req.trackingNumber} />
            {req.needsReturn && (
              <Field label="Tanggal Kembali"
                value={req.returnedAt ? fmtDate(req.returnedAt) : '⏳ Belum kembali'} />
            )}
            {req.processor && (
              <Field label="Diproses oleh" value={req.processor?.name} />
            )}
          </div>
          {req.shippingNote && (
            <div className="mt-3 p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
              <span className="font-semibold">Catatan pengiriman: </span>{req.shippingNote}
            </div>
          )}
        </div>
      )}

      {/* Items */}
      <div className="card p-4">
        {(() => {
          const hasAnyDebt = (req.items ?? []).some(i => i.shippedQty !== null && i.shippedQty < i.qty)
          return (
            <>
              <h2 className="text-sm font-semibold text-slate-600 mb-3 border-b border-slate-100 pb-2 flex items-center gap-2">
                Produk ({req.items?.length ?? 0} item)
                {hasAnyDebt && (
                  <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 border border-amber-200">
                    ⚠ Ada hutang stok
                  </span>
                )}
              </h2>
              <div className="space-y-2">
                {(req.items ?? []).map((item) => {
                  const vLabel = skuVariantLabel(item)
                  const isPartialItem = item.shippedQty !== null && item.shippedQty < item.qty
                  const remaining = isPartialItem ? item.qty - item.shippedQty : 0
                  return (
                    <div key={item.id} className={`flex items-center justify-between rounded-lg px-3 py-2.5 ${isPartialItem ? 'bg-amber-50 border border-amber-200' : 'bg-slate-50'}`}>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-slate-700 truncate">
                          {item.sku?.Product?.name ?? item.productName}
                        </div>
                        {vLabel && <div className="text-xs text-slate-400 mt-0.5">{vLabel}</div>}
                        {isPartialItem && (
                          <div className="text-xs text-amber-600 mt-0.5 font-medium">Sisa belum dikirim: {remaining}</div>
                        )}
                        {item.note && !item.note.startsWith('size:') && (
                          <div className="text-xs text-slate-400 italic">{item.note}</div>
                        )}
                      </div>
                      <div className="ml-3 flex-shrink-0 text-right">
                        {item.shippedQty !== null ? (
                          <div>
                            <span className={`text-sm font-semibold ${isPartialItem ? 'text-amber-600' : 'text-emerald-600'}`}>
                              {item.shippedQty}/{item.qty}
                            </span>
                            <div className="text-[10px] text-slate-400">dikirim</div>
                          </div>
                        ) : (
                          <div className="text-sm font-semibold text-indigo-600">×{item.qty}</div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )
        })()}
      </div>
    </div>
  )
}
