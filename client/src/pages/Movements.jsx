import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { movementsApi, warehousesApi, productsApi } from '../api'
import PageHeader from '../components/PageHeader'
import { Table, Pagination } from '../components/Table'

const TYPE_BADGE = {
  IN:         <span className="badge-green">▲ IN</span>,
  OUT:        <span className="badge-red">▼ OUT</span>,
  ADJUSTMENT: <span className="badge-amber">~ ADJ</span>,
}

function defaultDateFrom() {
  const d = new Date()
  d.setDate(d.getDate() - 29)
  return d.toISOString().slice(0, 10)
}

export default function Movements() {
  const [page, setPage]         = useState(1)
  const [typeFilter, setType]   = useState('')
  const [whFilter, setWh]       = useState('')
  const [prodFilter, setProd]   = useState('')
  const [dateFrom, setDateFrom] = useState(defaultDateFrom())
  const [dateTo, setDateTo]     = useState(new Date().toISOString().slice(0, 10))

  const filters = useMemo(() => ({
    type:        typeFilter  || undefined,
    WarehouseId: whFilter    || undefined,
    ProductId:   prodFilter  || undefined,
    dateFrom:    dateFrom    || undefined,
    dateTo:      dateTo      || undefined,
  }), [typeFilter, whFilter, prodFilter, dateFrom, dateTo])

  const { data, isLoading } = useQuery({
    queryKey: ['movements', { page, ...filters }],
    queryFn:  () => movementsApi.list({ page, limit: 15, ...filters }),
  })

  const { data: summary } = useQuery({
    queryKey: ['movements-summary', filters],
    queryFn:  () => movementsApi.summary(filters),
  })

  const { data: chartData } = useQuery({
    queryKey: ['movements-chart', filters],
    queryFn:  () => movementsApi.chart(filters),
  })

  const { data: warehouses } = useQuery({
    queryKey: ['warehouses', { limit: 100 }],
    queryFn:  () => warehousesApi.list({ limit: 100 }),
  })

  const { data: products } = useQuery({
    queryKey: ['products', { limit: 200 }],
    queryFn:  () => productsApi.list({ limit: 200 }),
  })

  function resetFilters() {
    setType(''); setWh(''); setProd('')
    setDateFrom(defaultDateFrom())
    setDateTo(new Date().toISOString().slice(0, 10))
    setPage(1)
  }

  function handleExport() {
    movementsApi.exportCsv(filters).then(blob => {
      const url = URL.createObjectURL(blob)
      const a   = document.createElement('a')
      a.href    = url
      a.download = `movements-${dateFrom ?? 'all'}-to-${dateTo ?? 'all'}.csv`
      a.click()
      URL.revokeObjectURL(url)
    })
  }

  const columns = [
    { key: 'type',      label: 'Tipe',      width: 110, render: r => TYPE_BADGE[r.type] ?? <span className="badge-muted">{r.type}</span> },
    { key: 'product',   label: 'Produk',   render: r => (
      <div>
        <p className="font-semibold text-slate-800">{r.Product?.name ?? `#${r.ProductId}`}</p>
        <p className="text-xs font-mono text-slate-400">{r.Product?.sku}</p>
      </div>
    )},
    { key: 'warehouse', label: 'Gudang', render: r => <span className="text-slate-500">{r.Warehouse?.name ?? '—'}</span> },
    { key: 'quantity',  label: 'Qty',       width: 90,  render: r => (
      <span className={`font-mono font-bold text-sm ${r.type === 'IN' ? 'text-success' : r.type === 'OUT' ? 'text-danger' : 'text-warning'}`}>
        {r.type === 'OUT' ? '−' : '+'}{r.quantity}
      </span>
    )},
    { key: 'ref',  label: 'Ref #', width: 80,  render: r => <span className="font-mono text-xs text-slate-400">#{r.ReferenceId ?? '—'}</span> },
    { key: 'date', label: 'Tanggal',  width: 140, render: r => <span className="text-xs text-slate-400">{new Date(r.createdAt).toLocaleString()}</span> },
  ]

  const net      = summary?.net ?? 0
  const netColor = net >= 0 ? 'text-success' : 'text-danger'

  return (
    <div className="px-6 py-6 space-y-5">
      <PageHeader
        title="Pergerakan Stok"
        subtitle={`${data?.pagination?.total ?? 0} catatan`}
        action={
          <button onClick={handleExport} className="btn-secondary text-sm flex items-center gap-1.5">
            <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd"/></svg>
            Export CSV
          </button>
        }
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <SummaryCard label="Total IN"    value={summary?.totalIn  ?? 0} color="text-success" />
        <SummaryCard label="Total OUT"   value={summary?.totalOut ?? 0} color="text-danger"  />
        <SummaryCard label="Adjustment"  value={summary?.totalAdj ?? 0} color="text-warning" />
        <SummaryCard label="Net Change"  value={net} color={netColor} prefix={net >= 0 ? '+' : ''} />
      </div>

      {/* Chart */}
      {chartData && chartData.length > 0 && (
        <div className="card p-4">
          <p className="text-sm font-semibold text-slate-600 mb-3">Daily Movements</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} margin={{ top: 0, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={d => d.slice(5)} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v, n) => [v, n]} labelFormatter={l => `Date: ${l}`} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="IN"         name="IN"         fill="#22c55e" radius={[3,3,0,0]} />
              <Bar dataKey="OUT"        name="OUT"        fill="#ef4444" radius={[3,3,0,0]} />
              <Bar dataKey="ADJUSTMENT" name="Adjustment" fill="#f59e0b" radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Filters + Table */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50 flex flex-wrap items-center gap-3">
          {/* Date range */}
          <div className="flex items-center gap-1.5">
            <label className="text-xs text-slate-500">From</label>
            <input
              type="date" className="select w-36 text-sm"
              value={dateFrom}
              onChange={e => { setDateFrom(e.target.value); setPage(1) }}
            />
          </div>
          <div className="flex items-center gap-1.5">
            <label className="text-xs text-slate-500">To</label>
            <input
              type="date" className="select w-36 text-sm"
              value={dateTo}
              onChange={e => { setDateTo(e.target.value); setPage(1) }}
            />
          </div>

          {/* Type */}
          <select className="select w-36 text-sm" value={typeFilter} onChange={e => { setType(e.target.value); setPage(1) }}>
            <option value="">All types</option>
            <option value="IN">IN</option>
            <option value="OUT">OUT</option>
            <option value="ADJUSTMENT">Adjustment</option>
          </select>

          {/* Warehouse */}
          <select className="select w-44 text-sm" value={whFilter} onChange={e => { setWh(e.target.value); setPage(1) }}>
            <option value="">All warehouses</option>
            {warehouses?.data?.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>

          {/* Product */}
          <select className="select w-48 text-sm" value={prodFilter} onChange={e => { setProd(e.target.value); setPage(1) }}>
            <option value="">All products</option>
            {products?.data?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>

          <button onClick={resetFilters} className="text-xs text-slate-400 hover:text-slate-600 underline ml-auto">Reset</button>
        </div>

        <Table columns={columns} data={data?.data} loading={isLoading} emptyText="No movements found" />
        <Pagination pagination={data?.pagination} onPageChange={setPage} />
      </div>
    </div>
  )
}

function SummaryCard({ label, value, color, prefix = '' }) {
  return (
    <div className="card p-4">
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      <p className={`text-2xl font-bold font-mono ${color}`}>{prefix}{value.toLocaleString()}</p>
    </div>
  )
}
