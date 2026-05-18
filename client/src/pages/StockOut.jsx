import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { stockOutApi } from '../api'
import PageHeader from '../components/PageHeader'
import { Table, Pagination } from '../components/Table'
import { PackageMinus, Eye } from 'lucide-react'

export default function StockOut() {
  const navigate    = useNavigate()
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['stock-out', { page }],
    queryFn:  () => stockOutApi.list({ page, limit: 10 }),
  })

  const columns = [
    { key: 'id',        label: '#',       width: 60,  render: r => <span className="font-mono text-xs text-slate-400">{r.id}</span> },
    { key: 'warehouse', label: 'Gudang',              render: r => <span className="font-semibold text-slate-800">{r.Warehouse?.name ?? '—'}</span> },
    { key: 'notes',     label: 'Catatan',             render: r => <span className="text-xs text-slate-400">{r.notes || '—'}</span> },
    { key: 'date',      label: 'Tanggal',             render: r => <span className="text-xs text-slate-400">{new Date(r.createdAt).toLocaleDateString('id-ID')}</span> },
    { key: 'actions',   label: '', width: 130, render: r => (
      <button onClick={() => navigate(`/stock-out/${r.id}`)} className="btn-secondary text-[10px] px-2 py-0.5 flex items-center gap-1 rounded">
        <Eye size={10} /> Lihat Detail
      </button>
    )},
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
