import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { dashboardApi, movementsApi, warehousesApi, channelsApi, skuChannelStocksApi } from '../api'
import { useAuth } from '../context/AuthContext'
import MyDayToday from '../components/tasks/MyDayToday'
import CompletedHistory from '../components/tasks/CompletedHistory'
import {
  Package, BoxesIcon, Wallet, Warehouse,
  ChevronDown, ChevronRight, Tag, TrendingUp,
  ArrowUpRight, ArrowDownRight, LayoutGrid, ChevronLeft, Megaphone,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Cell, CartesianGrid,
} from 'recharts'

// ── Constants ─────────────────────────────────────────────────────────────────

const BRAND    = '#C8102E'
const BRAND_20 = '#C8102E33'
const PALETTE  = ['#C8102E','#E85B75','#F0A0AE','#3B82F6','#60A5FA','#93C5FD','#10B981','#34D399']

// ── Formatters ────────────────────────────────────────────────────────────────

const fmtNum = (n) => Number(n ?? 0).toLocaleString('id-ID')

const fmtRp = (n) => {
  const v = Number(n ?? 0)
  if (v >= 1_000_000_000) return `Rp ${(v / 1_000_000_000).toFixed(1)}M`
  if (v >= 1_000_000)     return `Rp ${(v / 1_000_000).toFixed(1)}jt`
  if (v >= 1_000)         return `Rp ${(v / 1_000).toFixed(0)}rb`
  return `Rp ${fmtNum(v)}`
}

const fmtRpFull = (n) =>
  `Rp ${Number(n ?? 0).toLocaleString('id-ID')}`

// ── Stat Card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, icon: Icon, accent = BRAND, loading }) {
  return (
    <div className="card px-5 py-4 flex items-start gap-4">
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
        style={{ background: accent + '18' }}
      >
        <Icon size={18} style={{ color: accent }} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-1">{label}</p>
        {loading ? (
          <div className="h-7 w-24 bg-slate-100 rounded animate-pulse" />
        ) : (
          <p className="text-2xl font-bold text-slate-800 leading-none tabular-nums">{value}</p>
        )}
        {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
      </div>
    </div>
  )
}

// ── Custom chart tooltip ──────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label, unit = 'unit' }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg px-3 py-2 text-xs">
      <p className="font-semibold text-slate-600 mb-0.5">{label}</p>
      <p className="font-bold text-slate-800">{fmtNum(payload[0].value)} {unit}</p>
    </div>
  )
}

// ── Progress bar row ──────────────────────────────────────────────────────────

function ProgressRow({ label, value, total, sub, color = BRAND }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0
  return (
    <div className="py-2.5">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm font-semibold text-slate-700 truncate max-w-[60%]">{label}</span>
        <div className="text-right flex-shrink-0">
          <span className="text-sm font-bold tabular-nums text-slate-800">{fmtNum(value)}</span>
          <span className="text-xs text-slate-400 ml-1">unit</span>
          {sub && <span className="text-xs text-slate-400 ml-2">· {sub}</span>}
        </div>
      </div>
      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  )
}

// ── Warehouse × Article expandable rows ───────────────────────────────────────

function WarehouseArticleGroup({ warehouse, rows }) {
  const [open, setOpen] = useState(false)
  const total = rows.reduce((s, r) => s + r.totalStock, 0)
  const articles = rows.filter(r => r.warehouseId === warehouse.warehouseId)
  const maxStock = Math.max(...articles.map(a => a.totalStock), 1)

  return (
    <div className="border border-slate-100 rounded-xl overflow-hidden mb-2 last:mb-0">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-50/70 hover:bg-slate-100/60 transition-colors text-left"
      >
        <div className="flex items-center gap-2.5">
          {open ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
          <Warehouse size={14} className="text-slate-500" />
          <span className="text-sm font-bold text-slate-700">{warehouse.warehouseName}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold tabular-nums text-slate-800">{fmtNum(warehouse.totalStock)}</span>
          <span className="text-xs text-slate-400">unit</span>
          <span className="badge-muted text-[10px]">{articles.length} koleksi</span>
        </div>
      </button>

      {open && (
        <div className="px-4 py-2 divide-y divide-slate-50">
          {articles.map((art, i) => (
            <div key={`${art.warehouseId}-${art.articleId ?? 'null'}`} className="py-2.5">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2 min-w-0">
                  <Tag size={11} className="text-slate-300 flex-shrink-0" />
                  <span className="text-xs font-semibold text-slate-600 truncate">{art.articleName}</span>
                </div>
                <span className="text-xs font-bold tabular-nums text-slate-700 flex-shrink-0 ml-2">
                  {fmtNum(art.totalStock)} unit
                </span>
              </div>
              <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.round((art.totalStock / maxStock) * 100)}%`,
                    background: PALETTE[i % PALETTE.length],
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Card pagination ───────────────────────────────────────────────────────────

function CardPager({ page, total, perPage, onChange }) {
  const totalPages = Math.ceil(total / perPage)
  if (totalPages <= 1) return null
  return (
    <div className="flex items-center justify-between pt-3 mt-3 border-t border-slate-100">
      <button
        onClick={() => onChange(page - 1)}
        disabled={page === 0}
        className="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        <ChevronLeft size={13} />
      </button>
      <div className="flex items-center gap-1">
        {Array.from({ length: totalPages }).map((_, i) => (
          <button
            key={i}
            onClick={() => onChange(i)}
            className={`w-1.5 h-1.5 rounded-full transition-all duration-150 ${i === page ? 'bg-brand w-3' : 'bg-slate-200 hover:bg-slate-400'}`}
          />
        ))}
      </div>
      <button
        onClick={() => onChange(page + 1)}
        disabled={page >= totalPages - 1}
        className="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        <ChevronRight size={13} />
      </button>
    </div>
  )
}

// ── Recent movements ──────────────────────────────────────────────────────────

const TYPE_STYLE = {
  IN:         { text: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200', label: '▲ IN' },
  OUT:        { text: 'text-red-600',     bg: 'bg-red-50 border-red-200',         label: '▼ OUT' },
  ADJUSTMENT: { text: 'text-amber-600',   bg: 'bg-amber-50 border-amber-200',     label: '~ ADJ' },
}

function MovementRow({ m }) {
  const s = TYPE_STYLE[m.type] ?? { text: 'text-slate-500', bg: 'bg-slate-100 border-slate-200', label: m.type }
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-slate-50 last:border-0">
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border ${s.bg} ${s.text} flex-shrink-0 w-14 justify-center`}>
        {s.label}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-slate-700 truncate">{m.Product?.name ?? '—'}</p>
        <p className="text-[10px] text-slate-400 truncate">{m.Warehouse?.name ?? '—'}</p>
      </div>
      <div className="text-right flex-shrink-0">
        <p className={`text-sm font-bold tabular-nums ${s.text}`}>
          {m.type === 'OUT' ? '−' : '+'}{fmtNum(m.quantity)}
        </p>
        <p className="text-[10px] text-slate-400">{new Date(m.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}</p>
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

const ART_PER_PAGE = 4
const WH_PER_PAGE  = 2

export default function Dashboard() {
  const { user, hasPermission } = useAuth()
  const [artPage, setArtPage] = useState(0)
  const [whPage,  setWhPage]  = useState(0)
  const [selectedWh, setSelectedWh] = useState('')

  const canViewStock     = hasPermission('dashboard.view_stock')
  const canViewValue     = hasPermission('dashboard.view_value')
  const canViewAnalytics = hasPermission('dashboard.view_analytics')
  const canViewMovements = hasPermission('dashboard.view_movements')

  const { data: warehouses } = useQuery({
    queryKey: ['warehouses', { limit: 100 }],
    queryFn:  () => warehousesApi.list({ limit: 100 }),
  })

  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboard-stats', { warehouseId: selectedWh || undefined }],
    queryFn:  () => dashboardApi.getStats(selectedWh ? { warehouseId: selectedWh } : undefined),
    staleTime: 30_000,
  })

  const { data: movements } = useQuery({
    queryKey: ['movements', { limit: 10 }],
    queryFn:  () => movementsApi.list({ limit: 10 }),
    enabled:  canViewMovements,
  })

  const { data: channels } = useQuery({
    queryKey: ['channels', { limit: 200 }],
    queryFn:  () => channelsApi.list({ limit: 200 }),
    enabled:  canViewAnalytics,
  })
  const { data: allChannelStocks, isLoading: channelStocksLoading } = useQuery({
    queryKey: ['sku-channel-stocks', 'all'],
    queryFn:  () => skuChannelStocksApi.list({}),
    enabled:  canViewAnalytics,
  })

  // Berapa artikel (produk unik) & SKU yang publish per channel — tanpa qty,
  // cuma hitungan, dihitung dari SkuChannelStock yang isListed=true.
  const publishByChannel = useMemo(() => {
    const activeChannels = (channels?.data ?? []).filter(c => c.isActive)
    const listedRows = (allChannelStocks ?? []).filter(s => s.isListed)
    return activeChannels.map(c => {
      const rows = listedRows.filter(s => s.ChannelId === c.id)
      const skuIds     = new Set(rows.map(r => r.ProductSKUId))
      const articleIds = new Set(rows.map(r => r.ProductSKU?.ProductId).filter(Boolean))
      return { id: c.id, name: c.name, articleCount: articleIds.size, skuCount: skuIds.size }
    })
  }, [channels, allChannelStocks])

  const {
    totalProducts = 0,
    totalStock    = 0,
    totalValue    = 0,
    todayMovements          = 0,
    stockByArticle          = [],
    stockByWarehouse        = [],
    stockByWarehouseAndArticle = [],
  } = stats ?? {}

  // Sliced data for paginated cards
  const visibleArticles  = stockByArticle.slice(artPage * ART_PER_PAGE, (artPage + 1) * ART_PER_PAGE)
  const visibleWarehouses = stockByWarehouse.slice(whPage * WH_PER_PAGE, (whPage + 1) * WH_PER_PAGE)

  const maxVisibleArticleStock   = Math.max(...visibleArticles.map(a => a.totalStock), 1)
  const maxVisibleWarehouseStock = Math.max(...visibleWarehouses.map(w => w.totalStock), 1)

  // Unique warehouses for the expandable section
  const warehouseGroups = stockByWarehouse.map(wh => ({
    ...wh,
    rows: stockByWarehouseAndArticle.filter(r => r.warehouseId === wh.warehouseId),
  }))


  const greeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Selamat pagi'
    if (h < 17) return 'Selamat siang'
    return 'Selamat sore'
  }

  return (
    <div className="px-6 py-6 max-w-screen-xl mx-auto space-y-6">

      {/* ── Welcome ─────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-slate-800">
            {greeting()}, {user?.name?.split(' ')[0]} 👋
          </h2>
          <p className="text-sm text-slate-400 mt-0.5">Ringkasan inventaris terkini</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <select
            value={selectedWh}
            onChange={e => { setSelectedWh(e.target.value); setArtPage(0); setWhPage(0) }}
            className="input text-sm w-44"
          >
            <option value="">Semua Gudang</option>
            {(warehouses?.data ?? []).map(w => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
          <div className="text-xs text-slate-400 font-mono bg-white border border-slate-200 px-3 py-1.5 rounded-lg">
            {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
        </div>
      </div>

      {/* ── My Day: to-do hari ini + riwayat selesai per minggu/bulan ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <MyDayToday />
        <CompletedHistory />
      </div>

      {/* ── Top stats ───────────────────────────────────────── */}
      {(() => {
        const count = 1 + (canViewStock ? 1 : 0) + (canViewValue ? 1 : 0)
        const cols  = count === 3 ? 'sm:grid-cols-3' : count === 2 ? 'sm:grid-cols-2' : ''
        return (
          <div className={`grid grid-cols-1 gap-4 ${cols}`}>
            <StatCard label="Total Produk" value={fmtNum(totalProducts)} icon={Package} loading={isLoading} />
            {canViewStock && (
              <StatCard label="Total Stock" value={fmtNum(totalStock)} sub={selectedWh ? `unit · ${warehouses?.data?.find(w => String(w.id) === String(selectedWh))?.name ?? ''}` : 'unit · semua gudang'} icon={BoxesIcon} accent="#3B82F6" loading={isLoading} />
            )}
            {canViewValue && (
              <StatCard label="Nilai Inventaris" value={fmtRp(totalValue)} sub={isLoading ? '' : `${fmtRpFull(totalValue)} · berdasarkan harga SKU`} icon={Wallet} accent="#10B981" loading={isLoading} />
            )}
          </div>
        )
      })()}


      {/* ── Middle: Article breakdown + Warehouse chart ─────── */}
      {canViewAnalytics && <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Stock & Value per Koleksi */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Tag size={14} className="text-slate-500" />
              <h3 className="text-sm font-bold text-slate-800">Stock & Nilai per Koleksi</h3>
            </div>
            {stockByArticle.length > 0 && (
              <span className="text-[10px] text-slate-400 tabular-nums">
                {artPage * ART_PER_PAGE + 1}–{Math.min((artPage + 1) * ART_PER_PAGE, stockByArticle.length)} / {stockByArticle.length}
              </span>
            )}
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {[1,2,3,4].map(i => <div key={i} className="h-10 bg-slate-100 rounded-lg animate-pulse" />)}
            </div>
          ) : stockByArticle.length === 0 ? (
            <p className="text-sm text-slate-300 text-center py-8">Belum ada data koleksi</p>
          ) : (
            <>
              <div className="divide-y divide-slate-50">
                {visibleArticles.map((art, i) => {
                  const globalIdx = artPage * ART_PER_PAGE + i
                  return (
                    <div key={art.articleId ?? 'null'} className="py-3 first:pt-0 last:pb-0">
                      <div className="flex items-start justify-between gap-3 mb-1.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-2 h-2 rounded-full flex-shrink-0 mt-1" style={{ background: PALETTE[globalIdx % PALETTE.length] }} />
                          <span className="text-sm font-semibold text-slate-700 truncate">{art.articleName}</span>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-sm font-bold tabular-nums text-slate-800">{fmtNum(art.totalStock)} <span className="text-xs font-normal text-slate-400">unit</span></p>
                          {canViewValue && <p className="text-xs font-semibold text-emerald-600">{fmtRp(art.totalValue)}</p>}
                        </div>
                      </div>
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${Math.round((art.totalStock / maxVisibleArticleStock) * 100)}%`,
                            background: PALETTE[globalIdx % PALETTE.length],
                          }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
              <CardPager
                page={artPage}
                total={stockByArticle.length}
                perPage={ART_PER_PAGE}
                onChange={setArtPage}
              />
            </>
          )}
        </div>

        {/* Stock per Gudang — bar chart */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Warehouse size={14} className="text-slate-500" />
              <h3 className="text-sm font-bold text-slate-800">Stock per Gudang</h3>
            </div>
            <div className="flex items-center gap-2">
              {stockByWarehouse.length > 0 && (
                <span className="text-[10px] text-slate-400 tabular-nums">
                  {whPage * WH_PER_PAGE + 1}–{Math.min((whPage + 1) * WH_PER_PAGE, stockByWarehouse.length)} / {stockByWarehouse.length}
                </span>
              )}
              <span className="badge-muted text-[10px]">{stockByWarehouse.length} gudang</span>
            </div>
          </div>

          {isLoading ? (
            <div className="h-48 bg-slate-100 rounded-lg animate-pulse" />
          ) : stockByWarehouse.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-sm text-slate-300">
              Belum ada data gudang
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart
                  data={visibleWarehouses.map((w, i) => ({
                    name:  w.warehouseName.length > 14 ? w.warehouseName.slice(0, 14) + '…' : w.warehouseName,
                    stock: w.totalStock,
                    fill:  PALETTE[(whPage * WH_PER_PAGE + i) % PALETTE.length],
                  }))}
                  barSize={40}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: '#94A3B8', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#94A3B8', fontSize: 10 }} axisLine={false} tickLine={false} width={36} tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: BRAND_20, radius: 4 }} />
                  <Bar dataKey="stock" radius={[6, 6, 0, 0]}>
                    {visibleWarehouses.map((_, i) => (
                      <Cell key={i} fill={PALETTE[(whPage * WH_PER_PAGE + i) % PALETTE.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>

              {/* Mini list */}
              <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
                {visibleWarehouses.map((w, i) => {
                  const globalIdx = whPage * WH_PER_PAGE + i
                  const pct = Math.round((w.totalStock / maxVisibleWarehouseStock) * 100)
                  return (
                    <div key={w.warehouseId}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: PALETTE[globalIdx % PALETTE.length] }} />
                          <span className="text-xs text-slate-600 font-medium">{w.warehouseName}</span>
                        </div>
                        <span className="text-xs font-bold tabular-nums text-slate-700">{fmtNum(w.totalStock)} unit</span>
                      </div>
                      <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${pct}%`, background: PALETTE[globalIdx % PALETTE.length] }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>

              <CardPager
                page={whPage}
                total={stockByWarehouse.length}
                perPage={WH_PER_PAGE}
                onChange={setWhPage}
              />
            </>
          )}
        </div>
      </div>}

      {/* ── Publikasi per Channel ─────────────────────────────── */}
      {canViewAnalytics && (
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Megaphone size={14} className="text-slate-500" />
            <h3 className="text-sm font-bold text-slate-800">Publikasi per Channel</h3>
          </div>

          {channelStocksLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[1, 2, 3].map(i => <div key={i} className="h-16 bg-slate-100 rounded-lg animate-pulse" />)}
            </div>
          ) : publishByChannel.length === 0 ? (
            <p className="text-sm text-slate-300 text-center py-8">Belum ada channel aktif</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {publishByChannel.map((c, i) => (
                <div key={c.id} className="flex items-center gap-3 p-3 rounded-lg border border-slate-100 bg-slate-50/50">
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: PALETTE[i % PALETTE.length] }} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-700 truncate mb-1">{c.name}</p>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-slate-500"><span className="font-bold text-slate-800 tabular-nums">{fmtNum(c.articleCount)}</span> Artikel</span>
                      <span className="text-xs text-slate-500"><span className="font-bold text-slate-800 tabular-nums">{fmtNum(c.skuCount)}</span> SKU</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Bottom: Warehouse × Article + Movements ─────────── */}
      {(canViewAnalytics || canViewMovements) && <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

        {/* Warehouse × Article breakdown */}
        {canViewAnalytics && <div className="lg:col-span-3 card p-5">
          <div className="flex items-center gap-2 mb-4">
            <LayoutGrid size={14} className="text-slate-500" />
            <h3 className="text-sm font-bold text-slate-800">Breakdown Stock per Gudang × Koleksi</h3>
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {[1,2,3].map(i => <div key={i} className="h-12 bg-slate-100 rounded-xl animate-pulse" />)}
            </div>
          ) : warehouseGroups.length === 0 ? (
            <div className="text-center py-12 text-sm text-slate-300">
              Belum ada data stock di gudang
            </div>
          ) : (
            <div>
              <p className="text-xs text-slate-400 mb-3">Klik gudang untuk melihat breakdown per koleksi</p>
              {warehouseGroups.map(wh => (
                <WarehouseArticleGroup
                  key={wh.warehouseId}
                  warehouse={wh}
                  rows={stockByWarehouseAndArticle}
                />
              ))}
            </div>
          )}
        </div>}

        {/* Recent movements */}
        {canViewMovements && <div className="lg:col-span-2 card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-800">Pergerakan Terbaru</h3>
            <span className="badge-muted text-[10px]">{todayMovements} total pergerakan barang hari ini</span>
          </div>
          {(movements?.data ?? []).length === 0 ? (
            <div className="text-center py-8 text-sm text-slate-300">Belum ada pergerakan</div>
          ) : (
            <div>
              {(movements?.data ?? []).map(m => <MovementRow key={m.id} m={m} />)}
            </div>
          )}
        </div>}
      </div>}

    </div>
  )
}
