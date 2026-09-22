import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { packingJobsApi, incomingGoodsApi } from '../api'
import { useAuth } from '../context/AuthContext'
import PageHeader from '../components/PageHeader'
import SearchableSelect from '../components/SearchableSelect'
import { Table, Pagination } from '../components/Table'
import Modal from '../components/Modal'
import QRScanner from '../components/QRScanner'
import { useCompanyGuard } from '../hooks/useCompanyGuard'
import CompanyRequiredBanner from '../components/CompanyRequiredBanner'
import toast from 'react-hot-toast'
import {
  Plus, Eye, Play, ClipboardCheck, CheckSquare,
  ScanLine, CheckCircle2, AlertCircle,
} from 'lucide-react'

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_BADGE = {
  PENDING:     'bg-slate-100 text-slate-600',
  IN_PROGRESS: 'bg-amber-100 text-amber-700',
  SUBMITTED:   'bg-blue-100 text-blue-700',
  VERIFIED:    'bg-green-100 text-green-700',
}
const STATUS_LABEL = {
  PENDING:     'Menunggu',
  IN_PROGRESS: 'Dikerjakan',
  SUBMITTED:   'Dikirim',
  VERIFIED:    'Terverifikasi',
}
const STATUS_BG = {
  PENDING:     'bg-slate-50  border-slate-200',
  IN_PROGRESS: 'bg-amber-50  border-amber-200',
  SUBMITTED:   'bg-blue-50   border-blue-200',
  VERIFIED:    'bg-green-50  border-green-200',
}

// Backend FK is PascalCase — must match exactly
const EMPTY_FORM = { IncomingGoodsId: '', assignedTo: '', notes: '' }

// ── Mobile job card ───────────────────────────────────────────────────────────

function JobCard({ job, isTimPacking, isHeadPacking, onDetail, onStart, onSubmit, onVerify, startPending }) {
  return (
    <div className={`rounded-xl border p-4 space-y-3 ${STATUS_BG[job.status] ?? 'bg-white border-slate-200'}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-mono text-xs text-slate-500">Job #{job.id}</p>
          <p className="font-semibold text-slate-800 mt-0.5">
            {job.incomingGoods?.docNumber ?? '—'}
          </p>
        </div>
        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold flex-shrink-0 ${STATUS_BADGE[job.status]}`}>
          {STATUS_LABEL[job.status] ?? job.status}
        </span>
      </div>

      <div className="text-xs text-slate-500">
        Pekerja: <span className="font-medium text-slate-700">{job.assignedToUser?.name ?? '—'}</span>
      </div>

      <div className="flex gap-2 pt-1">
        <button
          onClick={() => onDetail(job)}
          className="flex-1 py-2.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-600 hover:bg-slate-50 active:scale-95 transition-all flex items-center justify-center gap-1.5"
        >
          <Eye size={13} /> Detail
        </button>

        {isTimPacking && job.status === 'PENDING' && (
          <button
            onClick={() => onStart(job.id)}
            disabled={startPending}
            className="flex-1 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold active:scale-95 transition-all flex items-center justify-center gap-1.5 disabled:opacity-60"
          >
            <Play size={13} /> Mulai
          </button>
        )}

        {isTimPacking && job.status === 'IN_PROGRESS' && (
          <button
            onClick={() => onSubmit(job)}
            className="flex-1 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold active:scale-95 transition-all flex items-center justify-center gap-1.5"
          >
            <ClipboardCheck size={13} /> Submit Hasil
          </button>
        )}

        {isHeadPacking && job.status === 'SUBMITTED' && (
          <button
            onClick={() => onVerify(job)}
            className="flex-1 py-2.5 rounded-lg bg-green-600 hover:bg-green-700 text-white text-xs font-semibold active:scale-95 transition-all flex items-center justify-center gap-1.5"
          >
            <CheckSquare size={13} /> Verifikasi
          </button>
        )}
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function PackingJobs() {
  const qc = useQueryClient()
  const { isHeadPacking, isTimPacking } = useAuth()
  const { needsCompany } = useCompanyGuard()

  const [searchParams, setSearchParams] = useSearchParams()
  const page  = Number(searchParams.get('page')  || '1')
  const limit = Number(searchParams.get('limit') || '15')
  const setPage = (p) => setSearchParams(prev => { prev.set('page', String(p)); return prev }, { replace: true })

  const [modal, setModal]             = useState(null)
  const [form, setForm]               = useState(EMPTY_FORM)
  const [submitItems, setSubmitItems] = useState([])
  const [highlightIdx, setHighlightIdx] = useState(null)
  const [showScanner, setShowScanner]   = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['packing-jobs', { page, limit }],
    queryFn:  () => packingJobsApi.list({ page, limit }),
  })

  const igQuery = useQuery({
    queryKey: ['incoming-goods', 'for-packing'],
    queryFn:  () => incomingGoodsApi.list({ status: 'PRODUCTION_NOTIFIED,PACKING_IN_PROGRESS', limit: 100 }),
    enabled:  modal === 'create',
  })

  const workersQuery = useQuery({
    queryKey: ['packing-workers'],
    queryFn:  () => packingJobsApi.getWorkers({ limit: 100 }),
    enabled:  modal === 'create',
  })

  const detailQuery = useQuery({
    queryKey: ['packing-jobs', modal?.id],
    queryFn:  () => packingJobsApi.get(modal.id),
    enabled:  !!modal?.id && modal?.mode === 'detail',
  })

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }))

  const createMut = useMutation({
    mutationFn: packingJobsApi.create,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['packing-jobs'] }); toast.success('Packing job dibuat'); setModal(null) },
    onError:   e => toast.error(e.response?.data?.message || 'Error'),
  })

  const startMut = useMutation({
    mutationFn: packingJobsApi.start,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['packing-jobs'] }); toast.success('Job dimulai') },
    onError:   e => toast.error(e.response?.data?.message || 'Error'),
  })

  const submitMut = useMutation({
    mutationFn: ({ id, data }) => packingJobsApi.submit(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['packing-jobs'] }); toast.success('Hasil packing dikirim'); setModal(null) },
    onError:   e => toast.error(e.response?.data?.message || 'Error'),
  })

  const verifyMut = useMutation({
    mutationFn: ({ id, data }) => packingJobsApi.verify(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['packing-jobs'] }); toast.success('Job terverifikasi — Form Anak Packing dibuat'); setModal(null) },
    onError:   e => toast.error(e.response?.data?.message || 'Error'),
  })

  // ── Handlers ──────────────────────────────────────────────────────────────

  const openDetail = (job) => setModal({ mode: 'detail', id: job.id })

  const openSubmit = async (job) => {
    const full = await packingJobsApi.get(job.id)
    // Backend returns nested as: 'incomingGoods' → 'items'
    const items = (full.incomingGoods?.items ?? []).map(item => ({
      IncomingGoodsItemId: item.id,   // PascalCase — must match backend
      productName: item.Product?.name ?? `Item #${item.id}`,
      productSku:  item.Product?.sku  ?? '',
      productId:   item.Product?.id,
      qtyOrdered:  item.qtyOrdered,
      qtyReady:       '',
      qtyReject:      '',
      rejectReason:   '',
      notes:          '',
    }))
    setSubmitItems(items)
    setHighlightIdx(null)
    setModal({ mode: 'submit', id: job.id })
  }

  const openVerify = (job) => setModal({ mode: 'verify', id: job.id, verifyNotes: '' })

  const handleCreate = (e) => { e.preventDefault(); createMut.mutate(form) }

  const handleSubmit = (e) => {
    e.preventDefault()
    const results = submitItems.map(({ IncomingGoodsItemId, qtyReady, qtyReject, rejectReason, notes }) => ({
      IncomingGoodsItemId,                    // PascalCase FK — backend requires this
      qtyReady:     Number(qtyReady)  || 0,
      qtyReject:    Number(qtyReject) || 0,
      rejectReason: rejectReason || null,
    }))
    submitMut.mutate({ id: modal.id, data: { results } })
  }

  const handleVerify = (e) => {
    e.preventDefault()
    verifyMut.mutate({ id: modal.id, data: { notes: modal.verifyNotes ?? '' } })
  }

  const setItemField = (idx, field) => (e) => {
    setSubmitItems(prev => {
      const next = [...prev]
      next[idx] = { ...next[idx], [field]: e.target.value }
      return next
    })
  }

  // QR scan → match by SKU or productId, highlight row
  const handleQRScan = (code) => {
    const idx = submitItems.findIndex(
      it => it.productSku === code || String(it.productId) === code
    )
    if (idx === -1) {
      toast.error(`Produk "${code}" tidak ditemukan dalam job ini`)
      return
    }
    setHighlightIdx(idx)
    toast.success(`Produk ditemukan: ${submitItems[idx].productName}`)
    setTimeout(() => {
      document.getElementById(`submit-row-${idx}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 100)
  }

  // ── Table columns (desktop) ────────────────────────────────────────────────

  const columns = [
    {
      key: 'id', label: 'No. Job', width: 100,
      render: r => <span className="font-mono text-xs font-semibold text-slate-600">#{r.id}</span>,
    },
    {
      key: 'incomingGoods', label: 'Barang Masuk',
      render: r => <span className="font-mono text-xs text-slate-600">{r.incomingGoods?.docNumber ?? '—'}</span>,
    },
    {
      key: 'assignedTo', label: 'Pekerja',
      render: r => <span className="text-slate-700">{r.assignedToUser?.name ?? '—'}</span>,
    },
    {
      key: 'status', label: 'Status', width: 130,
      render: r => (
        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_BADGE[r.status] ?? ''}`}>
          {STATUS_LABEL[r.status] ?? r.status}
        </span>
      ),
    },
    {
      key: 'actions', label: '', width: 120,
      render: r => (
        <div className="flex items-center gap-1">
          <button onClick={() => openDetail(r)} className="btn-edit" title="Detail"><Eye size={12} /></button>
          {isTimPacking && r.status === 'PENDING' && (
            <button onClick={() => startMut.mutate(r.id)} disabled={startMut.isPending}
              className="p-1.5 rounded text-amber-500 hover:bg-amber-50 transition-colors" title="Mulai">
              <Play size={12} />
            </button>
          )}
          {isTimPacking && r.status === 'IN_PROGRESS' && (
            <button onClick={() => openSubmit(r)}
              className="p-1.5 rounded text-blue-600 hover:bg-blue-50 transition-colors" title="Submit Hasil">
              <ClipboardCheck size={12} />
            </button>
          )}
          {isHeadPacking && r.status === 'SUBMITTED' && (
            <button onClick={() => openVerify(r)}
              className="p-1.5 rounded text-green-600 hover:bg-green-50 transition-colors" title="Verifikasi">
              <CheckSquare size={12} />
            </button>
          )}
        </div>
      ),
    },
  ]

  const jobs = data?.data ?? []
  const job  = detailQuery.data

  return (
    <div className="px-4 md:px-6 py-5 md:py-6">
      {needsCompany && <div className="mb-4"><CompanyRequiredBanner action="membuat packing job" /></div>}
      <PageHeader
        title="Packing Jobs"
        subtitle={`${data?.pagination?.total ?? 0} job`}
        action={
          isHeadPacking ? (
            <button onClick={() => { setForm(EMPTY_FORM); setModal('create') }} className="btn-primary">
              <Plus size={14} /> Buat Job
            </button>
          ) : null
        }
      />

      {/* Desktop: table */}
      <div className="hidden md:block card overflow-hidden">
        <Table columns={columns} data={jobs} loading={isLoading} emptyText="Belum ada packing job" />
        <Pagination pagination={data?.pagination} onPageChange={setPage} />
      </div>

      {/* Mobile: cards */}
      <div className="md:hidden space-y-3">
        {isLoading ? (
          <div className="text-center py-12 text-slate-400 text-sm">Memuat…</div>
        ) : jobs.length === 0 ? (
          <div className="text-center py-12 text-slate-400 text-sm">Belum ada packing job</div>
        ) : (
          jobs.map(j => (
            <JobCard
              key={j.id}
              job={j}
              isTimPacking={isTimPacking}
              isHeadPacking={isHeadPacking}
              onDetail={openDetail}
              onStart={id => startMut.mutate(id)}
              onSubmit={openSubmit}
              onVerify={openVerify}
              startPending={startMut.isPending}
            />
          ))
        )}
        {data?.pagination && (
          <Pagination pagination={data.pagination} onPageChange={setPage} />
        )}
      </div>

      {/* ── Create Modal ───────────────────────────────────────────────────── */}
      <Modal open={modal === 'create'} onClose={() => setModal(null)} title="Buat Packing Job" size="md">
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="label">Barang Masuk <span className="text-danger">*</span></label>
            <SearchableSelect
              value={form.IncomingGoodsId}
              onChange={v => setForm(f => ({ ...f, IncomingGoodsId: v }))}
              options={[{ value: '', label: '— Pilih —' }, ...(igQuery.data?.data ?? []).map(ig => ({ value: ig.id, label: ig.docNumber }))]}
              placeholder="— Pilih —"
              required
            />
          </div>
          <div>
            <label className="label">Tim Packing <span className="text-danger">*</span></label>
            <SearchableSelect
              value={form.assignedTo}
              onChange={v => setForm(f => ({ ...f, assignedTo: v }))}
              options={[{ value: '', label: '— Pilih Pekerja —' }, ...(workersQuery.data?.data ?? []).map(u => ({ value: u.id, label: u.name }))]}
              placeholder="— Pilih Pekerja —"
              required
            />
          </div>
          <div>
            <label className="label">Catatan</label>
            <input className="input" value={form.notes} onChange={set('notes')} placeholder="Instruksi khusus…" />
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={() => setModal(null)} className="btn-secondary flex-1 justify-center">Batal</button>
            <button type="submit" disabled={createMut.isPending} className="btn-primary flex-1 justify-center">
              {createMut.isPending ? 'Menyimpan…' : 'Buat Job'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Detail Modal ───────────────────────────────────────────────────── */}
      <Modal open={modal?.mode === 'detail'} onClose={() => setModal(null)} title="Detail Packing Job" size="lg">
        {detailQuery.isLoading ? (
          <div className="py-8 text-center text-sm text-slate-500">Memuat…</div>
        ) : job ? (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div><p className="text-slate-400 text-xs">No. Job</p><p className="font-mono font-semibold text-slate-800">#{job.id}</p></div>
              <div>
                <p className="text-slate-400 text-xs">Status</p>
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_BADGE[job.status] ?? ''}`}>
                  {STATUS_LABEL[job.status] ?? job.status}
                </span>
              </div>
              <div><p className="text-slate-400 text-xs">Barang Masuk</p><p className="font-mono text-slate-800">{job.incomingGoods?.docNumber ?? '—'}</p></div>
              <div><p className="text-slate-400 text-xs">Pekerja</p><p className="text-slate-800">{job.assignedToUser?.name ?? '—'}</p></div>
              {job.notes && <div className="col-span-2"><p className="text-slate-400 text-xs">Catatan</p><p className="text-slate-700">{job.notes}</p></div>}
            </div>

            {job.results?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Hasil Packing</p>
                <div className="rounded-lg border border-slate-200 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">Produk</th>
                        <th className="px-3 py-2 text-right text-xs font-semibold text-slate-500">Ready</th>
                        <th className="px-3 py-2 text-right text-xs font-semibold text-slate-500">Reject</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">Alasan Reject</th>
                      </tr>
                    </thead>
                    <tbody>
                      {job.results.map((r, i) => (
                        <tr key={r.id} className="border-b border-slate-100 last:border-0">
                          <td className="px-3 py-2 text-slate-800">{r.IncomingGoodsItem?.Product?.name ?? `Item #${i+1}`}</td>
                          <td className="px-3 py-2 text-right font-mono text-green-700 font-semibold">{r.qtyReady}</td>
                          <td className="px-3 py-2 text-right font-mono text-red-600 font-semibold">{r.qtyReject}</td>
                          <td className="px-3 py-2 text-slate-500 text-xs">{r.rejectReason || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        ) : null}
      </Modal>

      {/* ── Submit Hasil Modal ─────────────────────────────────────────────── */}
      <Modal open={modal?.mode === 'submit'} onClose={() => setModal(null)} title="Submit Hasil Packing" size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">Isi qty untuk setiap item. Wajib isi alasan jika ada reject.</p>
            <button
              type="button"
              onClick={() => setShowScanner(true)}
              className="flex items-center gap-1.5 text-xs font-medium text-brand hover:text-brand-light px-3 py-1.5 rounded-lg border border-brand/30 hover:bg-brand/5 transition-colors flex-shrink-0"
            >
              <ScanLine size={13} /> Scan QR
            </button>
          </div>

          <div className="rounded-lg border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[560px]">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">Produk</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-slate-500">Order</th>
                    <th className="px-3 py-2 text-xs font-semibold text-slate-500 w-24">Ready</th>
                    <th className="px-3 py-2 text-xs font-semibold text-slate-500 w-24">Reject</th>
                    <th className="px-3 py-2 text-xs font-semibold text-slate-500">Alasan Reject</th>
                  </tr>
                </thead>
                <tbody>
                  {submitItems.map((item, i) => (
                    <tr
                      key={item.IncomingGoodsItemId}
                      id={`submit-row-${i}`}
                      className={`border-b border-slate-100 last:border-0 transition-colors duration-300 ${
                        highlightIdx === i ? 'bg-brand/5 ring-1 ring-inset ring-brand/30' : ''
                      }`}
                    >
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1.5">
                          {highlightIdx === i && <CheckCircle2 size={12} className="text-brand flex-shrink-0" />}
                          <span className="font-medium text-slate-800 text-xs">{item.productName}</span>
                        </div>
                        {item.productSku && <p className="text-[10px] font-mono text-slate-400">{item.productSku}</p>}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-slate-500 text-xs">{item.qtyOrdered?.toLocaleString('id-ID')}</td>
                      <td className="px-2 py-1.5">
                        <input type="number" min="0" required
                          className="input text-sm py-1.5 text-right w-full"
                          value={item.qtyReady}
                          onChange={setItemField(i, 'qtyReady')}
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <input type="number" min="0" required
                          className="input text-sm py-1.5 text-right w-full"
                          value={item.qtyReject}
                          onChange={setItemField(i, 'qtyReject')}
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          className={`input text-sm py-1.5 w-full ${Number(item.qtyReject) > 0 ? 'border-red-300 bg-red-50' : ''}`}
                          value={item.rejectReason}
                          onChange={setItemField(i, 'rejectReason')}
                          placeholder={Number(item.qtyReject) > 0 ? 'Wajib diisi…' : '—'}
                          required={Number(item.qtyReject) > 0}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {submitItems.some(it => Number(it.qtyReady) + Number(it.qtyReject) > it.qtyOrdered) && (
            <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              <AlertCircle size={13} />
              Ada item dengan total qty melebihi qty order. Periksa kembali.
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={() => setModal(null)} className="btn-secondary flex-1 justify-center">Batal</button>
            <button type="submit" disabled={submitMut.isPending} className="btn-primary flex-1 justify-center">
              {submitMut.isPending ? 'Mengirim…' : 'Submit Hasil'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Verify Modal ───────────────────────────────────────────────────── */}
      <Modal open={modal?.mode === 'verify'} onClose={() => setModal(null)} title="Verifikasi Packing Job" size="sm">
        <form onSubmit={handleVerify} className="space-y-4">
          <p className="text-sm text-slate-600">
            Verifikasi hasil packing job ini. Form Anak Packing akan dibuat otomatis.
          </p>
          <div>
            <label className="label">Catatan Verifikasi</label>
            <textarea
              className="input" rows={3}
              value={modal?.verifyNotes ?? ''}
              onChange={e => setModal(m => ({ ...m, verifyNotes: e.target.value }))}
              placeholder="Catatan dari Head Packing…"
            />
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => setModal(null)} className="btn-secondary flex-1 justify-center">Batal</button>
            <button type="submit" disabled={verifyMut.isPending} className="btn-primary flex-1 justify-center">
              {verifyMut.isPending ? 'Memverifikasi…' : 'Verifikasi & Buat FAP'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── QR Scanner overlay ─────────────────────────────────────────────── */}
      {showScanner && (
        <QRScanner
          onScan={handleQRScan}
          onClose={() => setShowScanner(false)}
          hint="Scan QR / barcode produk untuk highlight item"
        />
      )}
    </div>
  )
}
