import { useState, useMemo, Fragment } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { movementsApi, warehousesApi, productsApi, productSkusApi, articlesApi, categoriesApi, stockOutApi, stockOutPurposesApi } from '../api'
import PageHeader from '../components/PageHeader'
import SearchableSelect from '../components/SearchableSelect'
import { Table, Pagination } from '../components/Table'
import { exportExcel } from '../utils/exportExcel'
import toast from 'react-hot-toast'
import { PackageSearch, Layers, Building2, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react'

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
  const [searchParams, setSearchParams] = useSearchParams()

  const page          = Number(searchParams.get('page')  || '1')
  const limit         = Number(searchParams.get('limit') || '15')
  const typeFilter    = searchParams.get('type')    || ''
  const whFilter      = searchParams.get('wh')      || ''
  const prodFilter    = searchParams.get('prod')    || ''
  const skuFilter     = searchParams.get('sku')     || ''
  const articleFilter = searchParams.get('article') || ''
  const catFilter     = searchParams.get('cat')     || ''
  const purposeFilter = searchParams.get('purpose') || ''
  const dateFrom      = searchParams.get('from')    || defaultDateFrom()
  const dateTo        = searchParams.get('to')      || new Date().toISOString().slice(0, 10)

  const sp = (updates) => setSearchParams(prev => {
    Object.entries(updates).forEach(([k, v]) => v ? prev.set(k, v) : prev.delete(k))
    return prev
  }, { replace: true })

  const setPage      = (p) => sp({ page: String(p) })
  const setType      = (v) => sp({ type: v, page: '1' })
  const setWh        = (v) => sp({ wh: v, page: '1' })
  const setProd      = (v) => sp({ prod: v, sku: '', page: '1' })
  const setSku       = (v) => sp({ sku: v, page: '1' })
  const setArt       = (v) => sp({ article: v, page: '1' })
  const setCat       = (v) => sp({ cat: v, page: '1' })
  const setPurp      = (v) => sp({ purpose: v, page: '1' })
  const setDateFrom  = (v) => sp({ from: v, page: '1' })
  const setDateTo    = (v) => sp({ to: v, page: '1' })

  const filters = useMemo(() => ({
    type:          typeFilter      || undefined,
    WarehouseId:   whFilter        || undefined,
    ProductId:     prodFilter      || undefined,
    ProductSKUId:  skuFilter       || undefined,
    ArticleId:     articleFilter   || undefined,
    CategoryId:    catFilter       || undefined,
    purpose:       purposeFilter   || undefined,
    dateFrom:      dateFrom        || undefined,
    dateTo:        dateTo          || undefined,
  }), [typeFilter, whFilter, prodFilter, skuFilter, articleFilter, catFilter, purposeFilter, dateFrom, dateTo])

  const { data, isLoading } = useQuery({
    queryKey: ['movements', { page, limit, ...filters }],
    queryFn:  () => movementsApi.list({ page, limit, ...filters }),
  })

  const { data: summary } = useQuery({
    queryKey: ['movements-summary', filters],
    queryFn:  () => movementsApi.summary(filters),
  })

  const { data: chartData } = useQuery({
    queryKey: ['movements-chart', filters],
    queryFn:  () => movementsApi.chart(filters),
  })

  const { data: outstandingRepairs } = useQuery({
    queryKey: ['stock-out-outstanding-repairs'],
    queryFn:  () => stockOutApi.outstandingRepairs(),
  })
  const [showAllOutstanding, setShowAllOutstanding] = useState(false)

  const outstandingSummary = useMemo(() => {
    const rows = outstandingRepairs ?? []
    const products = new Set(rows.map(r => r.product?.id ?? r.product?.name))
    const namedVendors  = new Set(rows.filter(r => r.vendor?.id).map(r => r.vendor.id))
    const missingVendor = rows.some(r => !r.vendor?.id)
    const qty   = rows.reduce((s, r) => s + (r.qtyOutstanding ?? 0), 0)
    const stale = rows.filter(r => r.isStale).length
    return { productCount: products.size, vendorCount: namedVendors.size, missingVendor, qty, stale }
  }, [outstandingRepairs])

  // Group per produk + dokumen Stock Out — variant/size-nya di-expand on-demand,
  // biar satu produk 4-size nggak makan 4 baris kayak sebelumnya.
  const outstandingGroups = useMemo(() => {
    const map = new Map()
    for (const r of outstandingRepairs ?? []) {
      const key = `${r.product?.id ?? r.product?.name}-${r.stockOutHeaderId}`
      if (!map.has(key)) {
        map.set(key, {
          key,
          productName: r.product?.name ?? '—',
          vendor: r.vendor,
          stockOutHeaderId: r.stockOutHeaderId,
          daysOutstanding: r.daysOutstanding,
          isStale: r.isStale,
          qtyOutstanding: 0,
          qtySent: 0,
          variants: [],
        })
      }
      const g = map.get(key)
      g.qtyOutstanding += r.qtyOutstanding ?? 0
      g.qtySent += r.qtySent ?? 0
      g.variants.push(r)
    }
    return [...map.values()].sort((a, b) => b.daysOutstanding - a.daysOutstanding)
  }, [outstandingRepairs])
  const [expandedGroups, setExpandedGroups] = useState(() => new Set())
  const toggleGroup = (key) => setExpandedGroups(prev => {
    const next = new Set(prev)
    next.has(key) ? next.delete(key) : next.add(key)
    return next
  })

  const { data: purposesData } = useQuery({
    queryKey: ['stock-out-purposes', { limit: 200 }],
    queryFn:  () => stockOutPurposesApi.list({ limit: 200 }),
  })
  const PURPOSES = (purposesData?.data ?? []).map(p => p.name)

  const { data: warehouses } = useQuery({
    queryKey: ['warehouses', { limit: 500 }],
    queryFn:  () => warehousesApi.list({ limit: 500 }),
  })

  const { data: products } = useQuery({
    queryKey: ['products', { limit: 500 }],
    queryFn:  () => productsApi.list({ limit: 500 }),
  })

  const { data: productSkus } = useQuery({
    queryKey: ['product-skus', prodFilter],
    queryFn:  () => productSkusApi.list(prodFilter),
    enabled:  !!prodFilter,
  })

  const { data: articles } = useQuery({
    queryKey: ['articles', { limit: 500 }],
    queryFn:  () => articlesApi.list({ limit: 500 }),
  })

  const { data: categories } = useQuery({
    queryKey: ['categories', { limit: 500 }],
    queryFn:  () => categoriesApi.list({ limit: 500 }),
  })

  function resetFilters() {
    setSearchParams(prev => {
      ['type','wh','prod','sku','article','cat','purpose'].forEach(k => prev.delete(k))
      prev.set('from', defaultDateFrom())
      prev.set('to', new Date().toISOString().slice(0, 10))
      prev.set('page', '1')
      return prev
    }, { replace: true })
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
      key: 'ref', label: 'Transaksi', width: 180,
      render: r => {
        if (!r.ReferenceId) return <span className="text-xs text-slate-400">—</span>
        let path, label
        if (r.source === 'TRANSFER') {
          path  = `/transfers/${r.ReferenceId}`
          label = 'Transfer'
        } else if (r.type === 'IN') {
          path  = `/stock-in/${r.ReferenceId}`
          label = 'Stock IN'
        } else if (r.type === 'OUT') {
          path  = `/stock-out/${r.ReferenceId}`
          label = 'Stock OUT'
        } else if (r.type === 'ADJUSTMENT') {
          path  = `/opname/${r.ReferenceId}`
          label = 'Opname'
        }
        if (!path) return <span className="font-mono text-xs text-slate-400">#{r.ReferenceId}</span>
        return (
          <button
            onClick={() => navigate(path)}
            className="btn-secondary text-[11px] px-2.5 py-1 flex items-center gap-1.5 rounded-lg whitespace-nowrap"
          >
            <span className="text-slate-400">Lihat detail</span>
            <span className="font-semibold text-slate-600">{label}</span>
            <span className="font-mono text-slate-400">#{r.ReferenceId}</span>
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

      {/* Barang Masih di Vendor (Retur Vendor yang belum sepenuhnya balik) */}
      {outstandingRepairs && outstandingRepairs.length > 0 && (
        <div className="card overflow-hidden border border-amber-200/70">
          <div className="relative px-5 pt-4 pb-4 bg-gradient-to-br from-amber-50 via-amber-50/40 to-transparent border-b border-amber-100">
            <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
              <div className="flex items-center gap-2">
                <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-amber-100 text-amber-600">
                  <PackageSearch size={17} />
                </span>
                <div>
                  <p className="text-sm font-bold text-slate-800 leading-tight">Barang Masih di Vendor</p>
                  <p className="text-[11px] text-slate-400 leading-tight">Retur perbaikan yang belum sepenuhnya balik</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <OutstandingStat icon={PackageSearch} label="Total Produk" value={outstandingSummary.productCount} />
              <OutstandingStat icon={Layers} label="Qty Outstanding" value={outstandingSummary.qty} accent="amber" />
              <OutstandingStat
                icon={Building2}
                label="Vendor Terlibat"
                value={outstandingSummary.vendorCount}
                note={outstandingSummary.missingVendor ? 'Ada item tanpa vendor tercatat' : null}
              />
              <OutstandingStat icon={AlertTriangle} label="Sudah > 14 Hari" value={outstandingSummary.stale} accent={outstandingSummary.stale > 0 ? 'red' : undefined} />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200">
                  <th className="th py-2 pl-5 text-left">Produk</th>
                  <th className="th py-2 text-left">Vendor</th>
                  <th className="th py-2 text-right w-24">Sisa Qty</th>
                  <th className="th py-2 text-right w-32">Lama di Vendor</th>
                  <th className="th py-2 pr-5 text-left w-28">Stock Out #</th>
                </tr>
              </thead>
              <tbody>
                {(showAllOutstanding ? outstandingGroups : outstandingGroups.slice(0, 8)).map(g => {
                  const isExpanded  = expandedGroups.has(g.key)
                  const hasVariants = g.variants.length > 1
                  return (
                    <Fragment key={g.key}>
                      <tr
                        tabIndex={0}
                        className="group border-b border-slate-100 last:border-0 hover:bg-amber-50/40 focus:bg-amber-50/40 focus:outline-none cursor-pointer transition-colors"
                        onClick={() => hasVariants ? toggleGroup(g.key) : navigate(`/stock-out/${g.stockOutHeaderId}`)}
                        onKeyDown={e => e.key === 'Enter' && (hasVariants ? toggleGroup(g.key) : navigate(`/stock-out/${g.stockOutHeaderId}`))}
                      >
                        <td className="td py-2.5 pl-5">
                          <p className="font-semibold text-slate-800 group-hover:text-violet-700 transition-colors flex items-center gap-1.5">
                            {hasVariants && (isExpanded
                              ? <ChevronUp size={13} className="text-slate-400 flex-shrink-0" />
                              : <ChevronDown size={13} className="text-slate-400 flex-shrink-0" />)}
                            {g.productName}
                          </p>
                          {hasVariants && <p className="text-xs text-slate-400 pl-[19px]">{g.variants.length} varian</p>}
                        </td>
                        <td className="td py-2.5 text-slate-600">{g.vendor?.name ?? '—'}</td>
                        <td className="td py-2.5 text-right font-mono font-bold text-danger">{g.qtyOutstanding} <span className="text-slate-300 font-normal">/ {g.qtySent}</span></td>
                        <td className="td py-2.5 text-right">
                          <span className={g.isStale ? 'badge-red inline-flex items-center gap-1' : 'badge-muted'}>
                            {g.isStale && <AlertTriangle size={11} />}
                            {g.daysOutstanding} hari
                          </span>
                        </td>
                        <td className="td py-2.5 pr-5">
                          <button
                            onClick={e => { e.stopPropagation(); navigate(`/stock-out/${g.stockOutHeaderId}`) }}
                            className="text-violet-600 hover:text-violet-800 font-medium hover:underline"
                          >
                            #{g.stockOutHeaderId}
                          </button>
                        </td>
                      </tr>
                      {isExpanded && g.variants.map(v => (
                        <tr key={v.id} className="border-b border-slate-100 last:border-0 bg-slate-50/40">
                          <td className="td py-2 pl-5">
                            <p className="text-xs text-slate-500 pl-[19px]">
                              {(v.sku?.ProductVariantOptions ?? []).map(o => o.value).join(' / ') || v.sku?.sku_code || '—'}
                            </p>
                          </td>
                          <td className="td py-2"></td>
                          <td className="td py-2 text-right font-mono text-xs text-slate-500">{v.qtyOutstanding} <span className="text-slate-300">/ {v.qtySent}</span></td>
                          <td className="td py-2"></td>
                          <td className="td py-2 pr-5"></td>
                        </tr>
                      ))}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
          {outstandingGroups.length > 8 && (
            <button
              onClick={() => setShowAllOutstanding(v => !v)}
              className="w-full flex items-center justify-center gap-1 text-xs text-violet-600 hover:text-violet-800 hover:bg-violet-50/50 font-semibold py-2.5 border-t border-slate-100 transition-colors"
            >
              {showAllOutstanding ? <>Sembunyikan <ChevronUp size={13} /></> : <>Lihat semua ({outstandingGroups.length - 8} lainnya) <ChevronDown size={13} /></>}
            </button>
          )}
        </div>
      )}

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
      <div className="card">
        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50 rounded-t-lg flex flex-wrap items-center gap-3">
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
            onChange={v => { setProd(v); setSku(''); setPage(1) }}
            options={[{ value: '', label: 'All products' }, ...(products?.data ?? []).map(p => ({ value: p.id, label: p.name }))]}
            placeholder="All products"
            className="w-48 text-sm"
          />
          {prodFilter && (
            <SearchableSelect
              value={skuFilter}
              onChange={v => { setSku(v); setPage(1) }}
              options={[
                { value: '', label: 'Semua size' },
                ...(productSkus ?? []).map(s => {
                  const opts  = s.ProductVariantOptions ?? []
                  const label = opts.length ? opts.map(o => o.value).join(' / ') : s.sku_code
                  return { value: s.id, label }
                }),
              ]}
              placeholder="Semua size"
              className="w-36 text-sm"
            />
          )}
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

        <div className="overflow-hidden rounded-b-lg">
          <Table columns={columns} data={data?.data} loading={isLoading} emptyText="No movements found" />
          <Pagination pagination={data?.pagination} onPageChange={setPage} />
        </div>
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

const STAT_ACCENTS = {
  slate: { icon: 'text-slate-400', value: 'text-slate-800' },
  amber: { icon: 'text-amber-500', value: 'text-amber-700' },
  red:   { icon: 'text-danger',    value: 'text-danger' },
}

function OutstandingStat({ icon: Icon, label, value, accent = 'slate', note }) {
  const c = STAT_ACCENTS[accent] ?? STAT_ACCENTS.slate
  return (
    <div className="rounded-xl bg-white/70 border border-white shadow-sm px-3 py-2.5">
      <div className="flex items-center gap-1.5 mb-1">
        {Icon && <Icon size={12} className={c.icon} />}
        <p className="text-[10.5px] font-medium text-slate-500 uppercase tracking-wide">{label}</p>
      </div>
      <p className={`text-xl font-bold font-mono leading-none ${c.value}`}>{value.toLocaleString()}</p>
      {note && <p className="text-[10px] text-amber-600 mt-1 leading-tight">{note}</p>}
    </div>
  )
}
