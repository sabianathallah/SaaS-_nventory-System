import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { opnameSessionsApi, warehousesApi } from '../api'
import PageHeader from '../components/PageHeader'
import SearchableSelect from '../components/SearchableSelect'
import { Table, Pagination } from '../components/Table'
import Modal from '../components/Modal'
import toast from 'react-hot-toast'
import { Plus, Eye, CheckCircle, ClipboardList } from 'lucide-react'
import { useCompanyGuard } from '../hooks/useCompanyGuard'
import CompanyRequiredBanner from '../components/CompanyRequiredBanner'

const STATUS_BADGE = {
  open:      <span className="badge-amber">● Berlangsung</span>,
  closed:    <span className="badge-green">✓ Selesai</span>,
  cancelled: <span className="badge-muted">✕ Dibatalkan</span>,
}

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

export default function Opname() {
  const qc       = useQueryClient()
  const navigate = useNavigate()
  const { needsCompany } = useCompanyGuard()

  const [searchParams, setSearchParams] = useSearchParams()
  const page          = Number(searchParams.get('page')  || '1')
  const limit         = Number(searchParams.get('limit') || '10')
  const statusFilter  = searchParams.get('status') || ''
  const whFilter      = searchParams.get('wh') || ''
  const showCancelled = searchParams.get('cancelled') === '1'

  const setPage = (p) => setSearchParams(prev => { prev.set('page', String(p)); return prev }, { replace: true })
  const setStatusFilter = (v) => setSearchParams(prev => { v ? prev.set('status', v) : prev.delete('status'); prev.set('page', '1'); return prev }, { replace: true })
  const setWhFilter = (v) => setSearchParams(prev => { v ? prev.set('wh', v) : prev.delete('wh'); prev.set('page', '1'); return prev }, { replace: true })
  const setShowCancelled = (v) => setSearchParams(prev => { v ? prev.set('cancelled', '1') : prev.delete('cancelled'); prev.set('page', '1'); return prev }, { replace: true })

  const [modal, setModal]                 = useState(null)
  const [form, setForm]                   = useState({ warehouseId: '', notes: '' })

  // When showCancelled=false and no explicit status filter, pass status=open,closed to exclude cancelled server-side
  const effectiveStatus = statusFilter || (!showCancelled ? 'open,closed' : undefined)
  const { data, isLoading } = useQuery({
    queryKey: ['opname', { page, limit, status: effectiveStatus, warehouseId: whFilter || undefined }],
    queryFn:  () => opnameSessionsApi.list({ page, limit, status: effectiveStatus, warehouseId: whFilter || undefined }),
  })
  const { data: warehouses } = useQuery({
    queryKey: ['warehouses', { limit: 100 }],
    queryFn:  () => warehousesApi.list({ limit: 100 }),
  })
  const { data: countOpen }      = useQuery({ queryKey: ['opname-count', 'open'],      queryFn: () => opnameSessionsApi.list({ limit: 1, status: 'open' }) })
  const { data: countClosed }    = useQuery({ queryKey: ['opname-count', 'closed'],    queryFn: () => opnameSessionsApi.list({ limit: 1, status: 'closed' }) })
  const { data: countCancelled } = useQuery({ queryKey: ['opname-count', 'cancelled'], queryFn: () => opnameSessionsApi.list({ limit: 1, status: 'cancelled' }) })

  const openCount      = countOpen?.pagination?.total      ?? 0
  const closedCount    = countClosed?.pagination?.total    ?? 0
  const cancelledCount = countCancelled?.pagination?.total ?? 0

  const create = useMutation({
    mutationFn: d => opnameSessionsApi.create(d),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['opname'] })
      qc.invalidateQueries({ queryKey: ['opname-count'] })
      toast.success('Session dibuat')
      setModal(null)
      navigate(`/opname/${data.id}`)
    },
    onError: e => toast.error(e.response?.data?.message || 'Error'),
  })

  const closeSession = useMutation({
    mutationFn: id => opnameSessionsApi.update(id, { status: 'closed' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['opname'] })
      qc.invalidateQueries({ queryKey: ['opname-count'] })
      qc.invalidateQueries({ queryKey: ['stocks'] })
      qc.invalidateQueries({ queryKey: ['movements'] })
      toast.success('Session ditutup — stok disesuaikan')
      setModal(null)
    },
    onError: e => toast.error(e.response?.data?.message || 'Error'),
  })

  // Server already filters cancelled when showCancelled=false (via effectiveStatus=open,closed)
  const visibleData = data?.data

  const columns = [
    { key: 'id',        label: '#',           width: 60,  render: r => <span className="font-mono text-xs text-slate-400">{r.id}</span> },
    { key: 'warehouse', label: 'Gudang',                  render: r => <span className="font-semibold text-slate-800">{r.Warehouse?.name ?? '—'}</span> },
    { key: 'status',    label: 'Status',      width: 120, render: r => STATUS_BADGE[r.status] ?? <span className="badge-muted">{r.status}</span> },
    { key: 'started',   label: 'Dibuka',      width: 110, render: r => <span className="text-xs text-slate-400">{fmtDate(r.started_at)}</span> },
    { key: 'finished',  label: 'Ditutup',     width: 110, render: r => <span className="text-xs text-slate-400">{r.finished_at ? fmtDate(r.finished_at) : '—'}</span> },
    { key: 'createdBy', label: 'Dibuat oleh', width: 130, render: r => (
      <div>
        <div className="text-xs text-slate-500">{r.User?.name ?? '—'}</div>
        {r.closer && <div className="text-[10px] text-indigo-500">Ditutup: {r.closer.name}</div>}
        {r.updater && !r.closer && r.updater.name !== r.User?.name && (
          <div className="text-[10px] text-slate-400">Diedit: {r.updater.name}</div>
        )}
      </div>
    )},
    { key: 'notes',     label: 'Catatan',                 render: r => <span className="text-xs text-slate-400">{r.notes || '—'}</span> },
    { key: 'actions',   label: '', width: 240, render: r => (
      <div className="flex gap-2">
        {r.status === 'open' && (
          <button onClick={() => navigate(`/opname/${r.id}`)} className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5">
            <ClipboardList size={12} /> Isi Opname
          </button>
        )}
        {r.status === 'closed' && (
          <button onClick={() => navigate(`/opname/${r.id}`)} className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5">
            <Eye size={12} /> Lihat Hasil
          </button>
        )}
        {r.status === 'open' && (
          <button
            onClick={() => setModal({ mode: 'close-confirm', data: r })}
            className="text-xs px-3 py-1.5 rounded font-medium flex items-center gap-1.5 bg-success-light text-success border border-success/20 hover:bg-success hover:text-white transition-colors"
          >
            <CheckCircle size={12} /> Tutup Sesi
          </button>
        )}
      </div>
    )},
  ]

  return (
    <div className="px-6 py-6 space-y-5">
      <PageHeader
        title="Stock Opname"
        subtitle={`${data?.pagination?.total ?? 0} sessions`}
        action={
          <button
            onClick={() => {
              if (needsCompany) return toast.error('Pilih perusahaan terlebih dahulu')
              setForm({ warehouseId: '', notes: '' }); setModal({ mode: 'create' })
            }}
            className="btn-primary"
            title={needsCompany ? 'Pilih perusahaan terlebih dahulu' : undefined}
          >
            <Plus size={14} /> New Session
          </button>
        }
      />
      {needsCompany && <CompanyRequiredBanner action="membuat sesi stock opname" />}

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="card p-4"><p className="text-xs text-slate-500 mb-1">Total Sesi</p><p className="text-2xl font-bold font-mono text-slate-800">{data?.pagination?.total ?? 0}</p></div>
        <div className="card p-4"><p className="text-xs text-slate-500 mb-1">Berlangsung</p><p className="text-2xl font-bold font-mono text-warning">{openCount}</p></div>
        <div className="card p-4"><p className="text-xs text-slate-500 mb-1">Selesai</p><p className="text-2xl font-bold font-mono text-success">{closedCount}</p></div>
        <div className="card p-4"><p className="text-xs text-slate-500 mb-1">Dibatalkan</p><p className="text-2xl font-bold font-mono text-slate-400">{cancelledCount}</p></div>
      </div>

      {/* Filters + Table */}
      <div className="card">
        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50 rounded-t-lg flex flex-wrap items-center gap-3">
          <SearchableSelect
            value={statusFilter}
            onChange={v => { setStatusFilter(v); setPage(1) }}
            options={[
              { value: '', label: 'Semua status' },
              { value: 'open', label: 'Berlangsung' },
              { value: 'closed', label: 'Selesai' },
              ...(showCancelled ? [{ value: 'cancelled', label: 'Dibatalkan' }] : []),
            ]}
            placeholder="All status"
            className="w-36 text-sm"
          />
          <SearchableSelect
            value={whFilter}
            onChange={v => { setWhFilter(v); setPage(1) }}
            options={[{ value: '', label: 'Semua gudang' }, ...(warehouses?.data ?? []).map(w => ({ value: w.id, label: w.name }))]}
            placeholder="All warehouses"
            className="w-44 text-sm"
          />
          <label className="flex items-center gap-2 text-xs text-slate-500 ml-auto cursor-pointer select-none">
            <input type="checkbox" className="rounded" checked={showCancelled} onChange={e => setShowCancelled(e.target.checked)} />
            Tampilkan Dibatalkan
          </label>
        </div>
        <div className="overflow-hidden rounded-b-lg">
          <Table columns={columns} data={visibleData} loading={isLoading} emptyText="Belum ada sesi opname" />
          <Pagination pagination={data?.pagination} onPageChange={setPage} />
        </div>
      </div>

      {/* ── CREATE MODAL ──────────────────────────────────────────────────────── */}
      <Modal open={modal?.mode === 'create'} onClose={() => setModal(null)} title="Buat Sesi Opname Baru">
        <form onSubmit={e => { e.preventDefault(); create.mutate({ WarehouseId: form.warehouseId, notes: form.notes }) }} className="space-y-4">
          <div>
            <label className="label">Gudang <span className="text-danger">*</span></label>
            <SearchableSelect
              value={form.warehouseId}
              onChange={v => setForm(f => ({ ...f, warehouseId: v }))}
              options={[{ value: '', label: 'Pilih gudang…' }, ...(warehouses?.data ?? []).map(w => ({ value: w.id, label: w.name }))]}
              placeholder="Pilih gudang…"
              required
            />
          </div>
          <div>
            <label className="label">Catatan</label>
            <input className="input" placeholder="Opsional…" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={() => setModal(null)} className="btn-secondary flex-1 justify-center">Batal</button>
            <button type="submit" disabled={create.isPending} className="btn-primary flex-1 justify-center">{create.isPending ? 'Membuat…' : 'Buat Sesi'}</button>
          </div>
        </form>
      </Modal>

      {/* ── CLOSE SESSION CONFIRM ─────────────────────────────────────────────── */}
      <Modal open={modal?.mode === 'close-confirm'} onClose={() => setModal(null)} title="Tutup Sesi Opname" size="sm">
        <p className="text-sm text-slate-600 mb-2">Sesi akan ditutup dan stok akan disesuaikan berdasarkan hasil hitung opname.</p>
        <p className="text-xs text-warning font-semibold mb-5">Tindakan ini tidak dapat dibatalkan.</p>
        <div className="flex gap-2">
          <button onClick={() => setModal(null)} className="btn-secondary flex-1 justify-center">Batal</button>
          <button onClick={() => closeSession.mutate(modal.data.id)} disabled={closeSession.isPending} className="btn-primary flex-1 justify-center">
            {closeSession.isPending ? 'Menutup…' : 'Tutup & Sesuaikan Stok'}
          </button>
        </div>
      </Modal>
    </div>
  )
}
