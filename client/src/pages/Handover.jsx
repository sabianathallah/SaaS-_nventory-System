import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { handoverApi } from '../api'
import PageHeader from '../components/PageHeader'
import { Table, Pagination } from '../components/Table'
import toast from 'react-hot-toast'
import { PackageCheck, Eye, Printer, Lock, ScanLine, CheckCircle, Trash2 } from 'lucide-react'

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

const STATUS_BADGE = {
  OPEN:   <span className="badge-amber">● Aktif</span>,
  CLOSED: <span className="badge bg-red-50 text-red-600 border border-red-200 flex items-center gap-1 w-fit"><Lock size={9} /> Ditutup</span>,
}

export default function Handover() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const page  = Number(searchParams.get('page')  || '1')
  const limit = Number(searchParams.get('limit') || '20')
  const setPage = (p) => setSearchParams(prev => { prev.set('page', String(p)); return prev }, { replace: true })

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['handovers'] })
    qc.invalidateQueries({ queryKey: ['handovers-count'] })
  }

  const closeMutation = useMutation({
    mutationFn: (id) => handoverApi.close(id),
    onSuccess: () => { invalidate(); toast.success('Sesi ditutup') },
    onError: () => toast.error('Gagal menutup sesi'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => handoverApi.destroy(id),
    onSuccess: () => { invalidate(); toast.success('Handover dibatalkan') },
    onError: () => toast.error('Gagal membatalkan handover'),
  })

  const { data, isLoading } = useQuery({
    queryKey: ['handovers', { page, limit }],
    queryFn:  () => handoverApi.list({ page, limit }),
  })

  const { data: countOpen }   = useQuery({ queryKey: ['handovers-count', 'OPEN'],   queryFn: () => handoverApi.list({ page: 1, limit: 1, status: 'OPEN' }) })
  const { data: countClosed } = useQuery({ queryKey: ['handovers-count', 'CLOSED'], queryFn: () => handoverApi.list({ page: 1, limit: 1, status: 'CLOSED' }) })

  const columns = [
    {
      key: 'id', label: '#', width: 60,
      render: r => <span className="font-mono text-xs text-slate-400">{r.id}</span>,
    },
    {
      key: 'date', label: 'Tanggal', width: 120,
      render: r => <span className="text-xs text-slate-500">{fmtDate(r.date)}</span>,
    },
    {
      key: 'ekspedisi', label: 'Ekspedisi',
      render: r => <span className="font-semibold text-slate-800">{r.ekspedisi}</span>,
    },
    {
      key: 'status', label: 'Status', width: 110,
      render: r => STATUS_BADGE[r.status] ?? <span className="badge-muted">{r.status}</span>,
    },
    {
      key: 'totalResi', label: 'Total Resi', width: 100,
      render: r => <span className="font-mono font-bold text-slate-700">{r.totalResi ?? 0}</span>,
    },
    {
      key: 'note', label: 'Catatan',
      render: r => <span className="text-xs text-slate-400 truncate max-w-[180px] block">{r.note || '—'}</span>,
    },
    {
      key: 'createdBy', label: 'Dibuat oleh', width: 130,
      render: r => (
        <div>
          <div className="text-xs text-slate-500">{r.User?.name ?? '—'}</div>
          {r.closer && <div className="text-[10px] text-indigo-500">Ditutup: {r.closer.name}</div>}
          {r.updater && !r.closer && r.updater.name !== r.User?.name && (
            <div className="text-[10px] text-slate-400">Diedit: {r.updater.name}</div>
          )}
        </div>
      ),
    },
    {
      key: 'actions', label: '', width: 220,
      render: r => (
        <div className="flex items-center gap-1 justify-end">
          {r.status === 'OPEN' ? (
            <>
              <button
                onClick={() => navigate(`/handover/${r.id}`)}
                className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1.5"
              >
                <ScanLine size={12} /> Scan Resi
              </button>
              <button
                onClick={() => { if (confirm(`Tutup sesi Handover #${r.id}?`)) closeMutation.mutate(r.id) }}
                disabled={closeMutation.isPending && closeMutation.variables === r.id}
                className="text-xs px-2.5 py-1.5 rounded font-medium flex items-center gap-1 bg-success-light text-success border border-success/20 hover:bg-success hover:text-white transition-colors disabled:opacity-50"
              >
                <CheckCircle size={12} /> Tutup
              </button>
              <button
                onClick={() => { if (confirm(`Batalkan Handover #${r.id}? Semua resi akan terhapus.`)) deleteMutation.mutate(r.id) }}
                disabled={deleteMutation.isPending && deleteMutation.variables === r.id}
                className="p-1.5 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 border border-slate-200 transition-colors"
                title="Batalkan handover"
              >
                <Trash2 size={12} />
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => navigate(`/handover/${r.id}`)}
                className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5"
              >
                <Eye size={12} /> Lihat Detail
              </button>
              <button
                onClick={() => navigate(`/handover/${r.id}?print=1`)}
                className="text-xs px-2.5 py-1.5 rounded font-medium flex items-center gap-1 bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 transition-colors"
              >
                <Printer size={12} />
              </button>
            </>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="px-6 py-6 space-y-5">
      <PageHeader
        title="Handover Pengiriman"
        subtitle="Dokumen serah terima paket kepada kurir"
        action={
          <button onClick={() => navigate('/handover/new')} className="btn-primary">
            <PackageCheck size={14} /> Buat Handover
          </button>
        }
      />

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card p-4">
          <p className="text-xs text-slate-500 mb-1">Total Dokumen</p>
          <p className="text-2xl font-bold font-mono text-slate-800">{data?.count ?? 0}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-slate-500 mb-1">Aktif</p>
          <p className="text-2xl font-bold font-mono text-warning">{countOpen?.count ?? 0}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-slate-500 mb-1">Ditutup</p>
          <p className="text-2xl font-bold font-mono text-slate-400">{countClosed?.count ?? 0}</p>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <Table
          columns={columns}
          data={data?.rows ?? []}
          loading={isLoading}
          emptyText="Belum ada dokumen handover"
        />
        {data?.totalPages > 1 && (
          <Pagination
            pagination={{ page, totalPages: data.totalPages, total: data.count, limit }}
            onPageChange={setPage}
          />
        )}
      </div>
    </div>
  )
}
