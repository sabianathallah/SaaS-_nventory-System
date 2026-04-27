import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { stockInApi } from '../api'
import PageHeader from '../components/PageHeader'
import { Table, Pagination } from '../components/Table'
import { PackagePlus, Eye } from 'lucide-react'

const fmt = (n) => Number(n ?? 0).toLocaleString('id-ID')
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

export default function StockIn() {
  const navigate = useNavigate()
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['stock-in', { page }],
    queryFn:  () => stockInApi.list({ page, limit: 10 }),
  })

  const columns = [
    {
      key: 'date', label: 'Tanggal', width: 130,
      render: r => <span className="text-xs font-mono text-slate-500">{fmtDate(r.date)}</span>,
    },
    {
      key: 'warehouse', label: 'Warehouse',
      render: r => <span className="text-slate-600">{r.Warehouse?.name ?? '—'}</span>,
    },
    {
      key: 'note', label: 'Notes',
      render: r => <span className="text-xs text-slate-400 truncate max-w-[200px] block">{r.note || '—'}</span>,
    },
    {
      key: 'itemCount', label: 'Items', width: 70,
      render: r => <span className="text-sm font-semibold text-slate-700">{r.itemCount ?? 0}</span>,
    },
    {
      key: 'grandTotal', label: 'Grand Total', width: 160,
      render: r => (
        <span className="font-mono font-bold text-sm text-slate-800">
          Rp {fmt(r.grandTotal)}
        </span>
      ),
    },
    {
      key: 'actions', label: '', width: 56,
      render: r => (
        <button
          onClick={() => navigate(`/stock-in/${r.id}`)}
          className="p-1.5 rounded text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
          title="Lihat detail"
        >
          <Eye size={13} />
        </button>
      ),
    },
  ]

  return (
    <div className="px-6 py-6">
      <PageHeader
        title="Stock IN"
        subtitle={`${data?.pagination?.total ?? 0} transaksi`}
        action={
          <button onClick={() => navigate('/stock-in/new')} className="btn-primary">
            <PackagePlus size={14} />
            New Stock IN
          </button>
        }
      />

      <div className="card overflow-hidden">
        <Table columns={columns} data={data?.data} loading={isLoading} emptyText="Belum ada transaksi stock in" />
        <Pagination pagination={data?.pagination} onPageChange={setPage} />
      </div>
    </div>
  )
}
