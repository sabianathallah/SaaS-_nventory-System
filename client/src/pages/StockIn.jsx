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
      key: 'id', label: 'No.', width: 70,
      render: r => <span className="font-mono text-xs font-semibold text-slate-400">#{r.id}</span>,
    },
    {
      key: 'date', label: 'Tanggal', width: 130,
      render: r => <span className="text-xs font-mono text-slate-500">{fmtDate(r.date)}</span>,
    },
    {
      key: 'warehouse', label: 'Gudang',
      render: r => <span className="text-slate-600">{r.Warehouse?.name ?? '—'}</span>,
    },
    {
      key: 'note', label: 'Catatan',
      render: r => <span className="text-xs text-slate-400 truncate max-w-[200px] block">{r.note || '—'}</span>,
    },
    {
      key: 'itemCount', label: 'Item', width: 60,
      render: r => <span className="text-sm font-semibold text-slate-700">{r.itemCount ?? 0}</span>,
    },
    {
      key: 'totalQty', label: 'Total Qty', width: 90,
      render: r => <span className="font-mono text-sm font-bold text-slate-700">{fmt(r.totalQty ?? 0)}</span>,
    },
    {
      key: 'grandTotal', label: 'Total Nilai', width: 150,
      render: r => (
        <span className="font-mono font-bold text-sm text-slate-800">
          Rp {fmt(r.grandTotal)}
        </span>
      ),
    },
    {
      key: 'createdBy', label: 'Oleh', width: 120,
      render: r => <span className="text-xs text-slate-500">{r.User?.name ?? '—'}</span>,
    },
    {
      key: 'actions', label: '', width: 120,
      render: r => (
        <button
          onClick={() => navigate(`/stock-in/${r.id}`)}
          className="btn-secondary text-[10px] px-2 py-0.5 flex items-center gap-1 rounded"
        >
          <Eye size={10} />
          Lihat Detail
        </button>
      ),
    },
  ]

  return (
    <div className="px-6 py-6">
      <PageHeader
        title="Penerimaan Stok"
        subtitle={`${data?.pagination?.total ?? 0} transaksi`}
        action={
          <button onClick={() => navigate('/stock-in/new')} className="btn-primary">
            <PackagePlus size={14} />
            Buat Baru
          </button>
        }
      />

      <div className="card overflow-hidden">
        <Table columns={columns} data={data?.data} loading={isLoading} emptyText="Belum ada transaksi" />
        <Pagination pagination={data?.pagination} onPageChange={setPage} />
      </div>
    </div>
  )
}
