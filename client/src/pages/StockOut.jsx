import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { stockOutApi } from '../api'
import PageHeader from '../components/PageHeader'
import { Table, Pagination } from '../components/Table'
import { PackageMinus, Eye } from 'lucide-react'

const fmt = (n) => Number(n ?? 0).toLocaleString('id-ID')
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

export default function StockOut() {
  const navigate    = useNavigate()
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['stock-out', { page }],
    queryFn:  () => stockOutApi.list({ page, limit: 10 }),
  })

  const columns = [
    {
      key: 'id', label: 'No.', width: 70,
      render: r => <span className="font-mono text-xs font-semibold text-slate-400">#{r.id}</span>,
    },
    {
      key: 'date', label: 'Tanggal', width: 120,
      render: r => <span className="text-xs font-mono text-slate-500">{fmtDate(r.date ?? r.createdAt)}</span>,
    },
    {
      key: 'warehouse', label: 'Gudang',
      render: r => <span className="font-semibold text-slate-800">{r.Warehouse?.name ?? '—'}</span>,
    },
    {
      key: 'purpose', label: 'Tujuan',
      render: r => r.purpose
        ? <span className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold bg-violet-50 text-violet-700 border border-violet-100 truncate max-w-[140px]">{r.purpose}</span>
        : <span className="text-xs text-slate-400">—</span>,
    },
    {
      key: 'itemCount', label: 'Item', width: 60,
      render: r => <span className="text-sm font-semibold text-slate-700">{r.itemCount ?? 0}</span>,
    },
    {
      key: 'totalQty', label: 'Total Qty', width: 90,
      render: r => <span className="font-mono text-sm text-danger font-bold">{fmt(r.totalQty ?? 0)}</span>,
    },
    {
      key: 'grandTotal', label: 'Total Nilai', width: 150,
      render: r => (
        <span className="font-mono font-bold text-sm text-slate-800">
          Rp {fmt(r.grandTotal ?? 0)}
        </span>
      ),
    },
    {
      key: 'createdBy', label: 'Oleh', width: 120,
      render: r => <span className="text-xs text-slate-500">{r.User?.name ?? '—'}</span>,
    },
    {
      key: 'notes', label: 'Catatan',
      render: r => <span className="text-xs text-slate-400 truncate max-w-[150px] block">{r.notes || '—'}</span>,
    },
    {
      key: 'actions', label: '', width: 120,
      render: r => (
        <button onClick={() => navigate(`/stock-out/${r.id}`)} className="btn-secondary text-[10px] px-2 py-0.5 flex items-center gap-1 rounded">
          <Eye size={10} /> Lihat Detail
        </button>
      ),
    },
  ]

  return (
    <div className="px-6 py-6">
      <PageHeader
        title="Pengeluaran Stok"
        subtitle={`${data?.pagination?.total ?? 0} transaksi`}
        action={
          <button onClick={() => navigate('/stock-out/new')} className="btn-primary">
            <PackageMinus size={14} /> New Stock OUT
          </button>
        }
      />
      <div className="card overflow-hidden">
        <Table columns={columns} data={data?.data} loading={isLoading} emptyText="Belum ada transaksi stock out" />
        <Pagination pagination={data?.pagination} onPageChange={setPage} />
      </div>
    </div>
  )
}
