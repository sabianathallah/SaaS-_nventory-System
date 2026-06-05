import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { handoverApi } from '../api'
import PageHeader from '../components/PageHeader'
import { Table, Pagination } from '../components/Table'
import { PackageCheck, Eye, Printer } from 'lucide-react'

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

export default function Handover() {
  const navigate = useNavigate()
  const [page, setPage]   = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['handovers', { page }],
    queryFn:  () => handoverApi.list({ page, limit: 20 }),
  })

  const columns = [
    {
      key: 'id', label: 'No.', width: 70,
      render: r => <span className="font-mono text-xs font-semibold text-slate-400">#{r.id}</span>,
    },
    {
      key: 'date', label: 'Tanggal', width: 130,
      render: r => <span className="text-xs font-mono text-slate-500">{fmtDate(r.date)}</span>,
    },
    {
      key: 'ekspedisi', label: 'Ekspedisi',
      render: r => (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-100">
          {r.ekspedisi}
        </span>
      ),
    },
    {
      key: 'totalResi', label: 'Total Resi', width: 100,
      render: r => <span className="font-mono text-sm font-bold text-slate-700">{r.totalResi ?? 0}</span>,
    },
    {
      key: 'note', label: 'Catatan',
      render: r => <span className="text-xs text-slate-400 truncate max-w-[200px] block">{r.note || '—'}</span>,
    },
    {
      key: 'createdBy', label: 'Dibuat oleh', width: 130,
      render: r => <span className="text-xs text-slate-500">{r.User?.name ?? '—'}</span>,
    },
    {
      key: 'actions', label: '', width: 110,
      render: r => (
        <div className="flex items-center gap-1 justify-end">
          <button
            onClick={() => navigate(`/handover/${r.id}`)}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200 transition-colors"
          >
            <Eye size={13} /> Detail
          </button>
          <button
            onClick={() => navigate(`/handover/${r.id}?print=1`)}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 transition-colors"
          >
            <Printer size={13} /> Print
          </button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Handover Pengiriman"
        subtitle="Dokumen serah terima paket kepada kurir"
        action={{
          label: 'Buat Handover',
          icon: PackageCheck,
          onClick: () => navigate('/handover/new'),
        }}
      />

      <Table
        columns={columns}
        data={data?.rows ?? []}
        loading={isLoading}
        emptyText="Belum ada dokumen handover"
      />

      {data?.totalPages > 1 && (
        <Pagination page={page} totalPages={data.totalPages} onChange={setPage} />
      )}
    </div>
  )
}
