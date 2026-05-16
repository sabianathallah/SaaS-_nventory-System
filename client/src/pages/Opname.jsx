import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
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
  open:      <span className="badge-amber">● Open</span>,
  closed:    <span className="badge-green">✓ Closed</span>,
  cancelled: <span className="badge-muted">✕ Cancelled</span>,
}

export default function Opname() {
  const qc       = useQueryClient()
  const navigate = useNavigate()
  const { needsCompany } = useCompanyGuard()

  const [page, setPage]                   = useState(1)
  const [statusFilter, setStatusFilter]   = useState('')
  const [whFilter, setWhFilter]           = useState('')
  const [showCancelled, setShowCancelled] = useState(false)
  const [modal, setModal]                 = useState(null)
  const [form, setForm]                   = useState({ warehouseId: '', notes: '' })

  const { data, isLoading } = useQuery({
    queryKey: ['opname', { page, status: statusFilter || undefined, warehouseId: whFilter || undefined }],
    queryFn:  () => opnameSessionsApi.list({ page, limit: 10, status: statusFilter || undefined, warehouseId: whFilter || undefined }),
  })
  const { data: warehouses } = useQuery({
    queryKey: ['warehouses', { limit: 100 }],
    queryFn:  () => warehousesApi.list({ limit: 100 }),
  })

  const openCount      = data?.data?.filter(s => s.status === 'open').length      ?? 0
  const closedCount    = data?.data?.filter(s => s.status === 'closed').length    ?? 0
  const cancelledCount = data?.data?.filter(s => s.status === 'cancelled').length ?? 0

  const create = useMutation({
    mutationFn: d => opnameSessionsApi.create(d),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['opname'] })
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
      qc.invalidateQueries({ queryKey: ['stocks'] })
      qc.invalidateQueries({ queryKey: ['movements'] })
      toast.success('Session ditutup — stok disesuaikan')
      setModal(null)
    },
    onError: e => toast.error(e.response?.data?.message || 'Error'),
  })

  const visibleData = showCancelled
    ? data?.data
    : data?.data?.filter(s => s.status !== 'cancelled')

  const columns = [
    { key: 'id',        label: '#',        width: 60,  render: r => <span className="font-mono text-xs text-slate-400">{r.id}</span> },
    { key: 'warehouse', label: 'Warehouse',            render: r => <span className="font-semibold text-slate-800">{r.Warehouse?.name ?? '—'}</span> },
    { key: 'status',    label: 'Status',    width: 110, render: r => STATUS_BADGE[r.status] ?? <span className="badge-muted">{r.status}</span> },
    { key: 'started',   label: 'Started',   width: 100, render: r => <span className="text-xs text-slate-400">{new Date(r.started_at).toLocaleDateString()}</span> },
    { key: 'finished',  label: 'Finished',  width: 100, render: r => <span className="text-xs text-slate-400">{r.finished_at ? new Date(r.finished_at).toLocaleDateString() : '—'}</span> },
    { key: 'notes',     label: 'Notes',                render: r => <span className="text-xs text-slate-400">{r.notes || '—'}</span> },
    { key: 'actions',   label: '', width: 240, render: r => (
      <div className="flex gap-2">
        {r.status === 'open' && (
          <button onClick={() => navigate(`/opname/${r.id}`)} className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5">
            <ClipboardList size={12} /> Fill Opname
          </button>
        )}
        {r.status === 'closed' && (
          <button onClick={() => navigate(`/opname/${r.id}`)} className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5">
            <Eye size={12} /> View Result
          </button>
        )}
        {r.status === 'open' && (
          <button
            onClick={() => setModal({ mode: 'close-confirm', data: r })}
            className="text-xs px-3 py-1.5 rounded font-medium flex items-center gap-1.5 bg-success-light text-success border border-success/20 hover:bg-success hover:text-white transition-colors"
          >
            <CheckCircle size={12} /> Close Session
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
        <div className="card p-4"><p className="text-xs text-slate-500 mb-1">Total Sessions</p><p className="text-2xl font-bold font-mono text-slate-800">{data?.pagination?.total ?? 0}</p></div>
        <div className="card p-4"><p className="text-xs text-slate-500 mb-1">Open</p><p className="text-2xl font-bold font-mono text-warning">{openCount}</p></div>
        <div className="card p-4"><p className="text-xs text-slate-500 mb-1">Closed</p><p className="text-2xl font-bold font-mono text-success">{closedCount}</p></div>
        <div className="card p-4"><p className="text-xs text-slate-500 mb-1">Cancelled</p><p className="text-2xl font-bold font-mono text-slate-400">{cancelledCount}</p></div>
      </div>

      {/* Filters + Table */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50 flex flex-wrap items-center gap-3">
          <SearchableSelect
            value={statusFilter}
            onChange={v => { setStatusFilter(v); setPage(1) }}
            options={[
              { value: '', label: 'All status' },
              { value: 'open', label: 'Open' },
              { value: 'closed', label: 'Closed' },
              ...(showCancelled ? [{ value: 'cancelled', label: 'Cancelled' }] : []),
            ]}
            placeholder="All status"
            className="w-36 text-sm"
          />
          <SearchableSelect
            value={whFilter}
            onChange={v => { setWhFilter(v); setPage(1) }}
            options={[{ value: '', label: 'All warehouses' }, ...(warehouses?.data ?? []).map(w => ({ value: w.id, label: w.name }))]}
            placeholder="All warehouses"
            className="w-44 text-sm"
          />
          <label className="flex items-center gap-2 text-xs text-slate-500 ml-auto cursor-pointer select-none">
            <input type="checkbox" className="rounded" checked={showCancelled} onChange={e => setShowCancelled(e.target.checked)} />
            Tampilkan Cancelled
          </label>
        </div>
        <Table columns={columns} data={visibleData} loading={isLoading} emptyText="Belum ada sesi opname" />
        <Pagination pagination={data?.pagination} onPageChange={setPage} />
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
        <p className="text-sm text-slate-600 mb-2">Sesi akan ditutup dan stok disesuaikan berdasarkan data hasil hitung opname.</p>
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
