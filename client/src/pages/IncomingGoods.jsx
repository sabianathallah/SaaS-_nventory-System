import { useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { vendorDeliveriesApi, articlesApi, productsApi, productSkusApi } from '../api'
import { useAuth } from '../context/AuthContext'
import PageHeader from '../components/PageHeader'
import SearchableSelect from '../components/SearchableSelect'
import { Table, Pagination } from '../components/Table'
import { useCompanyGuard } from '../hooks/useCompanyGuard'
import CompanyRequiredBanner from '../components/CompanyRequiredBanner'
import { Plus, Eye, Video, AlertCircle, TriangleAlert, BarChart2, List, Package, Truck } from 'lucide-react'

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
const fmtShortDate = (d) => {
  if (!d) return ''
  const [, m, day] = d.split('-')
  return `${day}/${m}`
}

function defaultFrom() {
  const d = new Date()
  d.setDate(d.getDate() - 29)
  return d.toISOString().slice(0, 10)
}

const hasSJ = (r) => !!r.sjNumber || (Array.isArray(r.sjPhotos) ? r.sjPhotos.length > 0 : !!r.sjPhotos)

// ── Analytics panel ─────────────────────────────────────────────────────────
function AnalyticsPanel() {
  const [searchParams, setSearchParams] = useSearchParams()

  const dateFrom     = searchParams.get('from')    || defaultFrom()
  const dateTo       = searchParams.get('to')      || new Date().toISOString().slice(0, 10)
  const articleId    = searchParams.get('article') || ''
  const productId    = searchParams.get('prod')    || ''
  const productSkuId = searchParams.get('sku')     || ''

  const sp = (updates) => setSearchParams(prev => {
    Object.entries(updates).forEach(([k, v]) => v ? prev.set(k, v) : prev.delete(k))
    return prev
  }, { replace: true })

  const filters = useMemo(() => ({
    dateFrom,
    dateTo,
    articleId:    articleId    || undefined,
    productId:    productId    || undefined,
    productSkuId: productSkuId || undefined,
  }), [dateFrom, dateTo, articleId, productId, productSkuId])

  const { data, isLoading } = useQuery({
    queryKey: ['vendor-deliveries-analytics', filters],
    queryFn:  () => vendorDeliveriesApi.analytics(filters),
  })

  const { data: articles } = useQuery({
    queryKey: ['articles', { limit: 200 }],
    queryFn:  () => articlesApi.list({ limit: 200 }),
  })

  const { data: products } = useQuery({
    queryKey: ['products', { limit: 200 }],
    queryFn:  () => productsApi.list({ limit: 200 }),
  })

  const { data: skus } = useQuery({
    queryKey: ['product-skus', productId],
    queryFn:  () => productSkusApi.list(productId),
    enabled:  !!productId,
  })

  const chart       = data?.chart       ?? []
  const topProducts = data?.topProducts ?? []
  const summary     = data?.summary     ?? { totalQty: 0, totalDeliveries: 0 }

  const maxQty = Math.max(...chart.map(r => r.qty), 1)

  function resetFilters() {
    setSearchParams(prev => {
      ['article', 'prod', 'sku'].forEach(k => prev.delete(k))
      prev.set('from', defaultFrom())
      prev.set('to', new Date().toISOString().slice(0, 10))
      return prev
    }, { replace: true })
  }

  const hasFilter = articleId || productId || productSkuId

  return (
    <div className="space-y-5">
      {/* Filter panel */}
      <div className="card p-4">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 items-end">
          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">Dari Tanggal</label>
            <input
              type="date"
              value={dateFrom}
              onChange={e => sp({ from: e.target.value, view: 'analytics' })}
              className="input text-xs w-full"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">Sampai Tanggal</label>
            <input
              type="date"
              value={dateTo}
              onChange={e => sp({ to: e.target.value, view: 'analytics' })}
              className="input text-xs w-full"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">Koleksi</label>
            <SearchableSelect
              value={articleId}
              onChange={v => sp({ article: v, view: 'analytics' })}
              options={[{ value: '', label: 'Semua koleksi' }, ...(articles?.data ?? []).map(a => ({ value: String(a.id), label: a.name }))]}
              placeholder="Semua koleksi"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">Produk</label>
            <SearchableSelect
              value={productId}
              onChange={v => sp({ prod: v, sku: '', view: 'analytics' })}
              options={[{ value: '', label: 'Semua produk' }, ...(products?.data ?? []).map(p => ({ value: String(p.id), label: p.name }))]}
              placeholder="Semua produk"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">Size / Varian</label>
            <SearchableSelect
              value={productSkuId}
              onChange={v => sp({ sku: v, view: 'analytics' })}
              options={[
                { value: '', label: productId ? 'Semua size' : 'Pilih produk dulu' },
                ...(skus ?? []).map(s => ({ value: String(s.id), label: s.sku_code })),
              ]}
              placeholder="Semua size"
              disabled={!productId}
            />
          </div>
        </div>
        {hasFilter && (
          <button
            onClick={resetFilters}
            className="mt-3 text-xs text-slate-500 hover:text-slate-800 underline"
          >
            Reset filter
          </button>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="card p-5 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
            <Package size={20} className="text-indigo-500" />
          </div>
          <div>
            <p className="text-[11px] text-slate-500 font-medium">Total Qty Masuk</p>
            <p className="text-2xl font-bold text-slate-800">{summary.totalQty.toLocaleString('id-ID')}</p>
          </div>
        </div>
        <div className="card p-5 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
            <Truck size={20} className="text-emerald-500" />
          </div>
          <div>
            <p className="text-[11px] text-slate-500 font-medium">Total Pengiriman</p>
            <p className="text-2xl font-bold text-slate-800">{summary.totalDeliveries.toLocaleString('id-ID')}</p>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-4">Qty Masuk per Hari</h3>
        {isLoading ? (
          <div className="h-48 flex items-center justify-center text-slate-400 text-sm">Memuat data…</div>
        ) : chart.length === 0 ? (
          <div className="h-48 flex items-center justify-center text-slate-400 text-sm">Tidak ada data di rentang ini</div>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={chart} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis
                dataKey="date"
                tickFormatter={fmtShortDate}
                tick={{ fontSize: 10, fill: '#94a3b8' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: '#94a3b8' }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip
                formatter={(v) => [v.toLocaleString('id-ID'), 'Qty']}
                labelFormatter={(l) => fmtDate(l)}
                contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
              />
              <Bar dataKey="qty" fill="#6366f1" radius={[3, 3, 0, 0]} maxBarSize={40} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Top products */}
      {topProducts.length > 0 && (
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Produk Terbanyak Masuk</h3>
          <div className="space-y-2">
            {topProducts.map((p, i) => (
              <div key={p.id} className="flex items-center gap-3">
                <span className="text-[10px] font-bold text-slate-400 w-4">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-xs font-medium text-slate-700 truncate">{p.name}</span>
                    <span className="text-xs font-bold text-indigo-600 ml-2 shrink-0">{p.qty.toLocaleString('id-ID')}</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-1.5">
                    <div
                      className="bg-indigo-400 h-1.5 rounded-full transition-all"
                      style={{ width: `${Math.round((p.qty / topProducts[0].qty) * 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function IncomingGoods() {
  const navigate = useNavigate()
  const { hasPermission } = useAuth()
  const canManage = hasPermission('packing.manage') || hasPermission('packing.incoming')
  const { needsCompany } = useCompanyGuard()

  const [searchParams, setSearchParams] = useSearchParams()
  const view          = searchParams.get('view')    || 'list'
  const page          = Number(searchParams.get('page')   || '1')
  const limit         = Number(searchParams.get('limit')  || '15')
  const sjFilter      = searchParams.get('sj')      || 'all'
  const statusFilter  = searchParams.get('status')  || 'all'
  const selisihFilter = searchParams.get('selisih') || 'all'

  const setView = (v) => setSearchParams(prev => {
    prev.set('view', v)
    // clear analytics-only params when switching to list
    if (v === 'list') {
      ['from', 'to', 'article', 'prod', 'sku'].forEach(k => prev.delete(k))
    }
    return prev
  }, { replace: true })

  const setPage = (p) => setSearchParams(prev => { prev.set('page', String(p)); return prev }, { replace: true })

  const applyFilter = (type, value) => setSearchParams(prev => {
    prev.set('sj',      type === 'sj'      ? value : 'all')
    prev.set('selisih', type === 'selisih' ? value : 'all')
    prev.set('status',  type === 'status'  ? value : 'all')
    prev.set('page', '1')
    return prev
  }, { replace: true })

  const { data, isLoading } = useQuery({
    queryKey: ['vendor-deliveries', { page, limit, sjFilter, selisihFilter, statusFilter }],
    queryFn:  () => vendorDeliveriesApi.list({
      page, limit,
      ...(sjFilter === 'missing' ? { sjMissing: true } : {}),
      ...(selisihFilter === 'unclear' ? { selisihFilter: 'unclear' } : {}),
      ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
    }),
    enabled: view === 'list',
  })

  const columns = [
    {
      key: 'id', label: '#', width: 60,
      render: r => <span className="font-mono text-xs text-slate-400">#{r.id}</span>,
    },
    {
      key: 'date', label: 'Tanggal', width: 120,
      render: r => <span className="text-xs font-mono text-slate-500">{fmtDate(r.date)}</span>,
    },
    {
      key: 'vendor', label: 'Vendor',
      render: r => <span className="font-semibold text-slate-800">{r.Vendor?.name ?? '—'}</span>,
    },
    {
      key: 'status', label: 'Status', width: 90,
      render: r => {
        if (r.status === 'draft')  return <span className="badge-muted text-[11px]">Draft</span>
        if (r.status === 'closed') return <span className="badge-green text-[11px]">Closed</span>
        return <span className="badge-indigo text-[11px]">Open</span>
      },
    },
    {
      key: 'sj', label: 'Surat Jalan', width: 200,
      render: r => {
        if (!hasSJ(r)) return (
          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
            <AlertCircle size={10} /> SJ Belum Dilampirkan
          </span>
        )
        return (
          <div className="flex flex-col gap-0.5">
            {r.sjNumber
              ? <span className="text-xs font-mono text-slate-600">{r.sjNumber}</span>
              : <span className="text-xs text-slate-300">—</span>
            }
            {Array.isArray(r.sjPhotos) && r.sjPhotos.length > 0 && (
              <span className="text-[10px] text-slate-400">{r.sjPhotos.length} foto</span>
            )}
          </div>
        )
      },
    },
    {
      key: 'items', label: 'Item', width: 100,
      render: r => (
        <div className="flex flex-col gap-0.5">
          <span className="font-semibold text-slate-700">{r.itemCount ?? 0} item</span>
          {r.selisihCount > 0 && (
            <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full w-fit ${
              r.selisihStatus === 'clear'
                ? 'text-emerald-600 bg-emerald-50 border border-emerald-200'
                : 'text-orange-600 bg-orange-50 border border-orange-200'
            }`}>
              <TriangleAlert size={9} />
              {r.selisihCount} selisih
              {r.selisihStatus === 'clear' ? ' · clear' : ''}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'video', label: 'Video', width: 70,
      render: r => r.videoLink
        ? <a href={r.videoLink} target="_blank" rel="noopener noreferrer" className="text-brand hover:underline flex items-center gap-1 text-xs"><Video size={12} /> Link</a>
        : <span className="text-xs text-slate-300">—</span>,
    },
    {
      key: 'by', label: 'Dibuat oleh', width: 130,
      render: r => <span className="text-xs text-slate-500">{r.Creator?.name ?? '—'}</span>,
    },
    {
      key: 'actions', label: '', width: 110,
      render: r => (
        <button onClick={() => navigate(`/incoming-goods/${r.id}`)} className="btn-secondary text-[10px] px-2 py-0.5 flex items-center gap-1 rounded">
          <Eye size={10} /> Lihat Detail
        </button>
      ),
    },
  ]

  const missingCount  = (data?.data ?? []).filter(r => !hasSJ(r)).length
  const unclearCount  = (data?.data ?? []).filter(r => r.selisihStatus === 'unclear').length
  const activeFilter  = selisihFilter === 'unclear' ? 'selisih' : sjFilter !== 'all' ? 'sj' : statusFilter !== 'all' ? 'status' : 'all'

  return (
    <div className="px-6 py-6">
      {needsCompany && <div className="mb-4"><CompanyRequiredBanner action="mencatat barang masuk" /></div>}
      <PageHeader
        title="Barang Masuk"
        subtitle={view === 'list' ? `${data?.pagination?.total ?? 0} transaksi` : 'Analitik'}
        action={canManage && view === 'list' && (
          <button onClick={() => navigate('/incoming-goods/new')} className="btn-primary">
            <Plus size={14} /> Catat Barang Masuk
          </button>
        )}
      />

      {/* Main view tabs */}
      <div className="flex items-center gap-1 mb-4 border-b border-slate-100 pb-0">
        <button
          onClick={() => setView('list')}
          className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors -mb-px ${
            view === 'list'
              ? 'border-slate-800 text-slate-800'
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          <List size={13} /> Daftar
        </button>
        <button
          onClick={() => setView('analytics')}
          className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors -mb-px ${
            view === 'analytics'
              ? 'border-indigo-500 text-indigo-600'
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          <BarChart2 size={13} /> Analitik
        </button>
      </div>

      {view === 'analytics' ? (
        <AnalyticsPanel />
      ) : (
        <>
          {/* Filter subtabs */}
          <div className="flex items-center gap-1 mb-4">
            <button
              onClick={() => applyFilter('sj', 'all')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                activeFilter === 'all'
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
              }`}
            >
              Semua
            </button>
            <button
              onClick={() => applyFilter('status', 'draft')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                activeFilter === 'status' && statusFilter === 'draft'
                  ? 'bg-slate-600 text-white'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
              }`}
            >
              Draft
            </button>
            <button
              onClick={() => applyFilter('sj', 'missing')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                activeFilter === 'sj'
                  ? 'bg-amber-500 text-white'
                  : 'text-amber-600 hover:bg-amber-50'
              }`}
            >
              <AlertCircle size={11} /> SJ Belum Dilampirkan
              {activeFilter === 'all' && missingCount > 0 && (
                <span className="bg-amber-100 text-amber-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  {missingCount}
                </span>
              )}
            </button>
            <button
              onClick={() => applyFilter('selisih', 'unclear')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                activeFilter === 'selisih'
                  ? 'bg-orange-500 text-white'
                  : 'text-orange-600 hover:bg-orange-50'
              }`}
            >
              <TriangleAlert size={11} /> Ada Selisih
              {activeFilter === 'all' && unclearCount > 0 && (
                <span className="bg-orange-100 text-orange-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  {unclearCount}
                </span>
              )}
            </button>
          </div>

          <div className="card overflow-hidden">
            <Table columns={columns} data={data?.data} loading={isLoading} emptyText="Belum ada catatan barang masuk" />
            <Pagination pagination={data?.pagination} onPageChange={setPage} />
          </div>
        </>
      )}
    </div>
  )
}
