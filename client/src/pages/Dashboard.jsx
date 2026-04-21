import { useQuery } from '@tanstack/react-query'
import { productsApi, stocksApi, warehousesApi, movementsApi, suppliersApi } from '../api'
import StatCard from '../components/StatCard'
import { Table } from '../components/Table'
import { Package, Warehouse, Truck, BoxesIcon, TrendingDown } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { useAuth } from '../context/AuthContext'

const RED = '#C8102E'
const RED_LIGHT = '#D93248'

const TYPE_BADGE = {
  IN:         <span className="badge-green text-[11px]">▲ IN</span>,
  OUT:        <span className="badge-red text-[11px]">▼ OUT</span>,
  ADJUSTMENT: <span style={{ background: '#FEF3C7', color: '#D97706', borderColor: '#FDE68A' }} className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold border">~ ADJ</span>,
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-card-md px-3 py-2">
      <p className="text-xs font-semibold text-slate-600 mb-0.5">{label}</p>
      <p className="text-sm font-bold" style={{ color: RED }}>{payload[0].value.toLocaleString()} units</p>
    </div>
  )
}

export default function Dashboard() {
  const { user } = useAuth()

  const { data: products }   = useQuery({ queryKey: ['products',   { limit: 1 }],   queryFn: () => productsApi.list({ limit: 1 }) })
  const { data: stocks }     = useQuery({ queryKey: ['stocks',     { limit: 100 }], queryFn: () => stocksApi.list({ limit: 100 }) })
  const { data: warehouses } = useQuery({ queryKey: ['warehouses', { limit: 100 }], queryFn: () => warehousesApi.list({ limit: 100 }) })
  const { data: suppliers }  = useQuery({ queryKey: ['suppliers',  { limit: 1 }],   queryFn: () => suppliersApi.list({ limit: 1 }) })
  const { data: movements }  = useQuery({ queryKey: ['movements',  { limit: 8 }],   queryFn: () => movementsApi.list({ limit: 8 }) })

  const totalQty  = stocks?.data?.reduce((s, x) => s + x.quantity, 0) ?? 0
  const lowStocks = stocks?.data?.filter(s => s.quantity < 20) ?? []

  const whData = warehouses?.data?.map(wh => ({
    name: wh.name.length > 10 ? wh.name.slice(0, 10) + '…' : wh.name,
    qty:  stocks?.data?.filter(s => s.WarehouseId === wh.id).reduce((s, x) => s + x.quantity, 0) ?? 0,
  })) ?? []

  const moveCols = [
    { key: 'type',      label: 'Type',      width: 90,  render: r => TYPE_BADGE[r.type] ?? <span className="badge-muted">{r.type}</span> },
    { key: 'product',   label: 'Product',               render: r => <span className="font-medium text-slate-700">{r.Product?.name ?? '—'}</span> },
    { key: 'warehouse', label: 'Warehouse',              render: r => <span className="text-slate-500 text-xs">{r.Warehouse?.name ?? '—'}</span> },
    { key: 'quantity',  label: 'Qty',       width: 70,  render: r => (
      <span className={`font-mono font-semibold text-sm ${r.type === 'IN' ? 'text-success' : r.type === 'OUT' ? 'text-danger' : 'text-warning'}`}>
        {r.type === 'OUT' ? '-' : '+'}{r.quantity}
      </span>
    )},
    { key: 'date',      label: 'Date',      width: 100, render: r => <span className="text-xs text-slate-400">{new Date(r.createdAt).toLocaleDateString()}</span> },
  ]

  return (
    <div className="px-6 py-6 space-y-6">
      {/* Welcome */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-800">Good morning, {user?.name?.split(' ')[0]} 👋</h2>
          <p className="text-xs text-slate-400 mt-0.5">Here's what's happening in your inventory today.</p>
        </div>
        <div className="text-xs text-slate-400 font-mono bg-white border border-slate-200 px-3 py-1.5 rounded-lg">
          {new Date().toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Products"  value={products?.pagination?.total ?? '—'}   icon={Package}   color="red" />
        <StatCard label="Total Stock Qty" value={totalQty.toLocaleString()}             icon={BoxesIcon} color="blue" sub="across all warehouses" />
        <StatCard label="Warehouses"      value={warehouses?.pagination?.total ?? '—'}  icon={Warehouse} color="green" />
        <StatCard label="Suppliers"       value={suppliers?.pagination?.total ?? '—'}   icon={Truck}     color="muted" />
      </div>

      {/* Low stock alert */}
      {lowStocks.length > 0 && (
        <div className="bg-danger-light border border-danger-border rounded-lg px-5 py-4 flex items-start gap-3">
          <TrendingDown size={16} className="text-danger mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-danger mb-2">{lowStocks.length} item{lowStocks.length > 1 ? 's' : ''} running low</p>
            <div className="flex flex-wrap gap-2">
              {lowStocks.map(s => (
                <span key={s.id} className="badge-red">
                  {s.Product?.name ?? `Product #${s.ProductId}`} — {s.quantity} left
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Chart */}
        <div className="lg:col-span-2 card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-700">Stock by Warehouse</h3>
            <span className="text-xs text-slate-400">{whData.length} warehouses</span>
          </div>
          {whData.length ? (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={whData} barSize={24} barCategoryGap="40%">
                <XAxis
                  dataKey="name"
                  tick={{ fill: '#94A3B8', fontSize: 10, fontFamily: 'Plus Jakarta Sans' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: '#94A3B8', fontSize: 10, fontFamily: 'Plus Jakarta Sans' }}
                  axisLine={false}
                  tickLine={false}
                  width={35}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: `${RED}0D`, radius: 4 }} />
                <Bar dataKey="qty" radius={[4, 4, 0, 0]}>
                  {whData.map((_, i) => (
                    <Cell key={i} fill={i % 2 === 0 ? RED : RED_LIGHT} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[180px] flex items-center justify-center text-slate-300 text-sm">
              No warehouse data yet
            </div>
          )}
        </div>

        {/* Recent movements */}
        <div className="lg:col-span-3 card overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-700">Recent Movements</h3>
            <span className="badge-muted">{movements?.pagination?.total ?? 0} total</span>
          </div>
          <Table columns={moveCols} data={movements?.data} emptyText="No movements yet" />
        </div>
      </div>
    </div>
  )
}
