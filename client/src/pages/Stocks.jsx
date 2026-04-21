import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { stocksApi, warehousesApi } from '../api'
import PageHeader from '../components/PageHeader'
import { Table, Pagination } from '../components/Table'
import SearchBar from '../components/SearchBar'
import { TrendingDown, AlertTriangle } from 'lucide-react'

function QtyCell({ qty }) {
  if (qty === 0)  return <span className="badge-red font-mono font-bold">{qty}</span>
  if (qty < 20)   return <span className="badge-amber font-mono font-bold">{qty}</span>
  return <span className="font-mono font-semibold text-success">{qty}</span>
}

export default function Stocks() {
  const [page, setPage]     = useState(1)
  const [whFilter, setWh]   = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['stocks', { page, WarehouseId: whFilter }],
    queryFn:  () => stocksApi.list({ page, limit: 15, WarehouseId: whFilter || undefined }),
  })
  const { data: warehouses } = useQuery({
    queryKey: ['warehouses', { limit: 100 }],
    queryFn:  () => warehousesApi.list({ limit: 100 }),
  })

  const lowStock = data?.data?.filter(s => s.quantity < 20) ?? []

  const columns = [
    { key: 'product',   label: 'Product',   render: r => (
      <div>
        <p className="font-semibold text-slate-800">{r.Product?.name ?? `#${r.ProductId}`}</p>
        <p className="text-xs font-mono text-slate-400">{r.Product?.sku}</p>
      </div>
    )},
    { key: 'warehouse', label: 'Warehouse', render: r => <span className="text-slate-500">{r.Warehouse?.name ?? '—'}</span> },
    { key: 'unit',      label: 'Unit',      width: 80,  render: r => <span className="badge-muted">{r.Product?.unit ?? '—'}</span> },
    { key: 'quantity',  label: 'Qty',       width: 120, render: r => <QtyCell qty={r.quantity} /> },
  ]

  return (
    <div className="px-6 py-6">
      <PageHeader
        title="Stock Levels"
        subtitle={`${data?.pagination?.total ?? 0} entries`}
        action={lowStock.length > 0 && (
          <div className="flex items-center gap-1.5 bg-danger-light border border-danger-border px-3 py-1.5 rounded-lg">
            <AlertTriangle size={13} className="text-danger" />
            <span className="text-xs font-semibold text-danger">{lowStock.length} low stock</span>
          </div>
        )}
      />

      {lowStock.length > 0 && (
        <div className="mx-6 mb-4 bg-warning-light border border-warning-border rounded-lg px-4 py-3 flex items-start gap-2.5">
          <TrendingDown size={15} className="text-warning mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-xs font-semibold text-warning mb-1.5">Items below minimum stock threshold (20 units)</p>
            <div className="flex flex-wrap gap-2">
              {lowStock.map(s => (
                <span key={s.id} className="badge-amber">
                  {s.Product?.name ?? `Product #${s.ProductId}`} · {s.Warehouse?.name} — {s.quantity}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
          <select className="select w-52" value={whFilter} onChange={e => { setWh(e.target.value); setPage(1) }}>
            <option value="">All warehouses</option>
            {warehouses?.data?.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </div>
        <Table columns={columns} data={data?.data} loading={isLoading} emptyText="No stock entries found" />
        <Pagination pagination={data?.pagination} onPageChange={setPage} />
      </div>
    </div>
  )
}
