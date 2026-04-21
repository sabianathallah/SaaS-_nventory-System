import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { movementsApi, warehousesApi } from '../api'
import PageHeader from '../components/PageHeader'
import { Table, Pagination } from '../components/Table'

const TYPE_BADGE = {
  IN:         <span className="badge-green">▲ IN</span>,
  OUT:        <span className="badge-red">▼ OUT</span>,
  ADJUSTMENT: <span className="badge-amber">~ ADJ</span>,
}

export default function Movements() {
  const [page, setPage]       = useState(1)
  const [typeFilter, setType] = useState('')
  const [whFilter, setWh]     = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['movements', { page, type: typeFilter, WarehouseId: whFilter }],
    queryFn:  () => movementsApi.list({ page, limit: 15, type: typeFilter || undefined, WarehouseId: whFilter || undefined }),
  })
  const { data: warehouses } = useQuery({
    queryKey: ['warehouses', { limit: 100 }],
    queryFn:  () => warehousesApi.list({ limit: 100 }),
  })

  const columns = [
    { key: 'type',      label: 'Type',      width: 110, render: r => TYPE_BADGE[r.type] ?? <span className="badge-muted">{r.type}</span> },
    { key: 'product',   label: 'Product',   render: r => (
      <div>
        <p className="font-semibold text-slate-800">{r.Product?.name ?? `#${r.ProductId}`}</p>
        <p className="text-xs font-mono text-slate-400">{r.Product?.sku}</p>
      </div>
    )},
    { key: 'warehouse', label: 'Warehouse', render: r => <span className="text-slate-500">{r.Warehouse?.name ?? '—'}</span> },
    { key: 'quantity',  label: 'Qty',       width: 90,  render: r => (
      <span className={`font-mono font-bold text-sm ${r.type === 'IN' ? 'text-success' : r.type === 'OUT' ? 'text-danger' : 'text-warning'}`}>
        {r.type === 'OUT' ? '−' : '+'}{r.quantity}
      </span>
    )},
    { key: 'ref',       label: 'Ref #',     width: 80,  render: r => <span className="font-mono text-xs text-slate-400">#{r.ReferenceId ?? '—'}</span> },
    { key: 'date',      label: 'Date',      width: 140, render: r => <span className="text-xs text-slate-400">{new Date(r.createdAt).toLocaleString()}</span> },
  ]

  return (
    <div className="px-6 py-6">
      <PageHeader title="Stock Movements" subtitle={`${data?.pagination?.total ?? 0} total records`} />

      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
          <select className="select w-40" value={typeFilter} onChange={e => { setType(e.target.value); setPage(1) }}>
            <option value="">All types</option>
            <option value="IN">IN</option>
            <option value="OUT">OUT</option>
            <option value="ADJUSTMENT">Adjustment</option>
          </select>
          <select className="select w-52" value={whFilter} onChange={e => { setWh(e.target.value); setPage(1) }}>
            <option value="">All warehouses</option>
            {warehouses?.data?.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </div>
        <Table columns={columns} data={data?.data} loading={isLoading} emptyText="No movements found" />
        <Pagination pagination={data?.pagination} onPageChange={setPage} />
      </div>
    </div>
  )
}
