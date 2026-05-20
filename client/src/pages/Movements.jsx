import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { movementsApi, warehousesApi, productsApi, articlesApi, categoriesApi } from '../api'
import PageHeader from '../components/PageHeader'
import SearchableSelect from '../components/SearchableSelect'
import { Table, Pagination } from '../components/Table'
import { exportExcel } from '../utils/exportExcel'
import toast from 'react-hot-toast'

const PURPOSES = ['Penjualan','Endorse','Photoshoot','R&D','Pemakaian Internal','Hadiah / Gift','Sample','Retur Vendor','Lainnya']

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
  const navigate = useNavigate()
  const [page, setPage]           = useState(1)
  const [typeFilter, setType]     = useState('')
  const [whFilter, setWh]         = useState('')
  const [prodFilter, setProd]     = useState('')
  const [articleFilter, setArt]   = useState('')
  const [catFilter, setCat]       = useState('')
  const [purposeFilter, setPurp]  = useState('')
  const [dateFrom, setDateFrom]   = useState(defaultDateFrom())
  const [dateTo, setDateTo]       = useState(new Date().toISOString().slice(0, 10))

  const filters = useMemo(() => ({
    type:        typeFilter      || undefined,
    WarehouseId: whFilter        || undefined,
    ProductId:   prodFilter      || undefined,
    ArticleId:   articleFilter   || undefined,
    CategoryId:  catFilter       || undefined,
    purpose:     purposeFilter   || undefined,
    dateFrom:    dateFrom        || undefined,
    dateTo:      dateTo          || undefined,
  }), [typeFilter, whFilter, prodFilter, articleFilter, catFilter, purposeFilter, dateFrom, dateTo])

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

  const { data: articles } = useQuery({
    queryKey: ['articles', { limit: 200 }],
    queryFn:  () => articlesApi.list({ limit: 200 }),
  })

  const { data: categories } = useQuery({
    queryKey: ['categories', { limit: 200 }],
    queryFn:  () => categoriesApi.list({ limit: 200 }),
  })

  function resetFilters() {
    setType(''); setWh(''); setProd(''); setArt(''); setCat(''); setPurp('')
    setDateFrom(defaultDateFrom())
    setDateTo(new Date().toISOString().slice(0, 10))
    setPage(1)
  }

  function handleExportCsv() {
    movementsApi.exportCsv(filters).then(blob => {
      const url = URL.createObjectURL(blob)
      const a   = document.createElement('a')
      a.href    = url
      a.download = `movements-${dateFrom ?? 'all'}-to-${dateTo ?? 'all'}.csv`
      a.click()
      URL.revokeObjectURL(url)
    })
  }

  const [exporting, setExporting] = useState(false)
  async function handleExportExcel() {
    setExporting(true)
    try {
      const result = await movementsApi.list({ ...filters, limit: 9999 })
      const headers = ['No', 'Tanggal', 'Tipe', 'Tujuan', 'Produk', 'SKU Produk', 'Varian / SKU', 'Gudang', 'Qty', 'Keterangan', 'Ref #']
      const rows = (result.data ?? []).map((m, i) => {
        const opts    = m.ProductSKU?.ProductVariantOptions ?? []
        const variant = opts.map(o => o.value).join(' / ') || m.ProductSKU?.sku_code || '—'
        return [
          i + 1,
          new Date(m.date ?? m.createdAt).toLocaleString('id-ID'),
          m.type,
          m.type === 'OUT' ? (m.purpose ?? '—') : '—',
          m.Product?.name ?? `#${m.ProductId}`,
          m.Product?.sku ?? '—',
          variant,
          m.Warehouse?.name ?? '—',
          m.quantity,
          m.note ?? '—',
          m.ReferenceId ?? '—',
        ]
      })
      exportExcel(`pergerakan-${dateFrom ?? 'all'}-to-${dateTo ?? 'all'}`, { headers, rows, sheetName: 'Pergerakan Stok' })
    } catch {
      toast.error('Gagal export Excel')
    } finally {
      setExporting(false)
    }
  }

  const columns = [
    {
      key: 'date', label: 'Tanggal', width: 130,
      render: r => <span className="text-xs text-slate-400">{new Date(r.date ?? r.createdAt).toLocaleString('id-ID')}</span>,
    },
    {
      key: 'type', label: 'Tipe', width: 100,
      render: r => TYPE_BADGE[r.type] ?? <span className="badge-muted">{r.type}</span>,
    },
    {
      key: 'product', label: 'Produk',
      render: r => {
        const opts    = r.ProductSKU?.ProductVariantOptions ?? []
        const variant = opts.map(o => o.value).join(' / ') || r.ProductSKU?.sku_code
        return (
          <div>
            <p className="font-semibold text-slate-800">{r.Product?.name ?? `#${r.ProductId}`}</p>
            <p className="text-xs font-mono text-slate-400">{r.Product?.sku}</p>
            {variant && <p className="text-xs text-slate-500 mt-0.5">{variant}</p>}
          </div>
        )
      },
    },
    {
      key: 'purpose', label: 'Tujuan', width: 130,
      render: r => r.type === 'OUT' && r.purpose
        ? <span className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold bg-violet-50 text-violet-700 border border-violet-100 truncate max-w-[120px]">{r.purpose}</span>
        : <span className="text-xs text-slate-300">—</span>,
    },
    {
      key: 'warehouse', label: 'Gudang', width: 130,
      render: r => <span className="text-slate-500 text-sm">{r.Warehouse?.name ?? '—'}</span>,
    },
    {
      key: 'quantity', label: 'Qty', width: 80,
      render: r => (
        <span className={`font-mono font-bold text-sm ${r.type === 'IN' ? 'text-success' : r.type === 'OUT' ? 'text-danger' : 'text-warning'}`}>
          {r.type === 'OUT' ? '−' : r.type === 'IN' ? '+' : ''}{Math.abs(r.quantity)}
        </span>
      ),
    },
    {
      key: 'note', label: 'Keterangan',
      render: r => <span className="text-xs text-slate-400 truncate max-w-[160px] block">{r.note || '—'}</span>,
    },
    {
      key: 'ref', label: 'Ref #', width: 80,
      render: r => {
        if (!r.ReferenceId) return <span className="font-mono text-xs text-slate-400">—</span>
        const path = r.type === 'IN' ? `/stock-in/${r.ReferenceId}` : r.type === 'OUT' ? `/stock-out/${r.ReferenceId}` : r.type === 'ADJUSTMENT' ? `/opname/${r.ReferenceId}` : null
        if (!path) return <span className="font-mono text-xs text-slate-400">#{r.ReferenceId}</span>
        return (
          <button
            onClick={() => navigate(path)}
            className="btn-secondary text-[10px] px-2 py-0.5 flex items-center gap-1 rounded font-mono"
          >
            #{r.ReferenceId}
          </button>
        )
      },
    },
  ]

  const net      = summary?.net ?? 0
  const netColor = net >= 0 ? 'text-success' : 'text-danger'

  return (
    <div className="px-6 py-6 space-y-5">
      <PageHeader
        title="Pergerakan Stok"
        subtitle={`${data?.pagination?.total ?? 0} catatan`}
        action={
          <div className="flex items-center gap-2">
            <button onClick={handleExportExcel} disabled={exporting} className="btn-secondary text-sm flex items-center gap-1.5">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18M3 9h6M3 15h6M15 9l3 3-3 3M12 12h6"/></svg>
              {exporting ? 'Exporting…' : 'Excel'}
            </button>
            <button onClick={handleExportCsv} className="btn-secondary text-sm flex items-center gap-1.5">
              <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd"/></svg>
              CSV
            </button>
          </div>
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

          <SearchableSelect
            value={typeFilter}
            onChange={v => { setType(v); setPage(1) }}
            options={[
              { value: '', label: 'All types' },
              { value: 'IN', label: 'IN' },
              { value: 'OUT', label: 'OUT' },
              { value: 'ADJUSTMENT', label: 'Adjustment' },
            ]}
            placeholder="All types"
            className="w-36 text-sm"
          />
          <SearchableSelect
            value={whFilter}
            onChange={v => { setWh(v); setPage(1) }}
            options={[{ value: '', label: 'All warehouses' }, ...(warehouses?.data ?? []).map(w => ({ value: w.id, label: w.name }))]}
            placeholder="All warehouses"
            className="w-44 text-sm"
          />
          <SearchableSelect
            value={prodFilter}
            onChange={v => { setProd(v); setPage(1) }}
            options={[{ value: '', label: 'All products' }, ...(products?.data ?? []).map(p => ({ value: p.id, label: p.name }))]}
            placeholder="All products"
            className="w-48 text-sm"
          />
          <SearchableSelect
            value={articleFilter}
            onChange={v => { setArt(v); setPage(1) }}
            options={[{ value: '', label: 'All koleksi' }, ...(articles?.data ?? []).map(a => ({ value: a.id, label: a.name }))]}
            placeholder="All koleksi"
            className="w-40 text-sm"
          />
          <SearchableSelect
            value={catFilter}
            onChange={v => { setCat(v); setPage(1) }}
            options={[{ value: '', label: 'All kategori' }, ...(categories?.data ?? []).map(c => ({ value: c.id, label: c.name }))]}
            placeholder="All kategori"
            className="w-40 text-sm"
          />
          <SearchableSelect
            value={purposeFilter}
            onChange={v => { setPurp(v); setPage(1) }}
            options={[{ value: '', label: 'All tujuan' }, ...PURPOSES.map(p => ({ value: p, label: p }))]}
            placeholder="All tujuan"
            className="w-44 text-sm"
          />

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
