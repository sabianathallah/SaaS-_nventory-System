import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { dashboardApi, movementsApi } from '../api'
import { useAuth } from '../context/AuthContext'
import {
  Package, BoxesIcon, Wallet, Warehouse,
  ChevronDown, ChevronRight, Tag, TrendingUp,
  ArrowUpRight, ArrowDownRight, LayoutGrid,
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
          <span className="badge-muted text-[10px]">{articles.length} artikel</span>
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

export default function Dashboard() {
  const { user } = useAuth()

  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn:  dashboardApi.getStats,
    staleTime: 30_000,
  })

  const { data: movements } = useQuery({
    queryKey: ['movements', { limit: 10 }],
    queryFn:  () => movementsApi.list({ limit: 10 }),
  })

  const {
    totalProducts = 0,
    totalStock    = 0,
    totalValue    = 0,
    stockByArticle          = [],
    stockByWarehouse        = [],
    stockByWarehouseAndArticle = [],
  } = stats ?? {}

  // Unique warehouses for the expandable section
  const warehouseGroups = stockByWarehouse.map(wh => ({
    ...wh,
    rows: stockByWarehouseAndArticle.filter(r => r.warehouseId === wh.warehouseId),
  }))

  const maxWarehouseStock = Math.max(...stockByWarehouse.map(w => w.totalStock), 1)
  const maxArticleStock   = Math.max(...stockByArticle.map(a => a.totalStock), 1)

  const greeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Selamat pagi'
    if (h < 17) return 'Selamat siang'
    return 'Selamat sore'
  }

  return (
    <div className="px-6 py-6 max-w-screen-xl mx-auto space-y-6">

      {/* ── Welcome ─────────────────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">
            {greeting()}, {user?.name?.split(' ')[0]} 👋
          </h2>
          <p className="text-sm text-slate-400 mt-0.5">Ringkasan inventaris terkini</p>
        </div>
        <div className="text-xs text-slate-400 font-mono bg-white border border-slate-200 px-3 py-1.5 rounded-lg flex-shrink-0">
          {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </div>
      </div>

      {/* ── Top stats ───────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="Total Produk"
          value={fmtNum(totalProducts)}
          icon={Package}
          loading={isLoading}
        />
        <StatCard
          label="Total Stock"
          value={fmtNum(totalStock)}
          sub="unit · dari semua SKU"
          icon={BoxesIcon}
          accent="#3B82F6"
          loading={isLoading}
        />
        <StatCard
          label="Total Nilai Inventaris"
          value={fmtRp(totalValue)}
          sub={isLoading ? '' : fmtRpFull(totalValue)}
          icon={Wallet}
          accent="#10B981"
          loading={isLoading}
        />
      </div>

      {/* ── Middle: Article breakdown + Warehouse chart ─────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Stock & Value per Artikel */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Tag size={14} className="text-slate-500" />
            <h3 className="text-sm font-bold text-slate-800">Stock & Nilai per Artikel</h3>
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {[1,2,3].map(i => <div key={i} className="h-10 bg-slate-100 rounded-lg animate-pulse" />)}
            </div>
          ) : stockByArticle.length === 0 ? (
            <p className="text-sm text-slate-300 text-center py-8">Belum ada data artikel</p>
          ) : (
            <div className="divide-y divide-slate-50">
              {stockByArticle.map((art, i) => (
                <div key={art.articleId ?? 'null'} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex items-start justify-between gap-3 mb-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-2 h-2 rounded-full flex-shrink-0 mt-1" style={{ background: PALETTE[i % PALETTE.length] }} />
                      <span className="text-sm font-semibold text-slate-700 truncate">{art.articleName}</span>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-bold tabular-nums text-slate-800">{fmtNum(art.totalStock)} <span className="text-xs font-normal text-slate-400">unit</span></p>
                      <p className="text-xs font-semibold text-emerald-600">{fmtRp(art.totalValue)}</p>
                    </div>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${Math.round((art.totalStock / maxArticleStock) * 100)}%`,
                        background: PALETTE[i % PALETTE.length],
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Stock per Gudang — bar chart */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Warehouse size={14} className="text-slate-500" />
              <h3 className="text-sm font-bold text-slate-800">Stock per Gudang</h3>
            </div>
            <span className="badge-muted text-[10px]">{stockByWarehouse.length} gudang</span>
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
                <BarChart data={stockByWarehouse.map(w => ({ name: w.warehouseName.length > 12 ? w.warehouseName.slice(0,12)+'…' : w.warehouseName, stock: w.totalStock }))} barSize={28}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: '#94A3B8', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#94A3B8', fontSize: 10 }} axisLine={false} tickLine={false} width={36} tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: BRAND_20, radius: 4 }} />
                  <Bar dataKey="stock" radius={[5, 5, 0, 0]}>
                    {stockByWarehouse.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>

              {/* Mini list di bawah chart */}
              <div className="mt-3 space-y-1.5 border-t border-slate-100 pt-3">
                {stockByWarehouse.map((w, i) => (
                  <div key={w.warehouseId} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ background: PALETTE[i % PALETTE.length] }} />
                      <span className="text-xs text-slate-600 font-medium">{w.warehouseName}</span>
                    </div>
                    <span className="text-xs font-bold tabular-nums text-slate-700">{fmtNum(w.totalStock)} unit</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Bottom: Warehouse × Article + Movements ─────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

        {/* Warehouse × Article breakdown */}
        <div className="lg:col-span-3 card p-5">
          <div className="flex items-center gap-2 mb-4">
            <LayoutGrid size={14} className="text-slate-500" />
            <h3 className="text-sm font-bold text-slate-800">Breakdown Stock per Gudang × Artikel</h3>
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
              <p className="text-xs text-slate-400 mb-3">Klik gudang untuk melihat breakdown per artikel</p>
              {warehouseGroups.map(wh => (
                <WarehouseArticleGroup
                  key={wh.warehouseId}
                  warehouse={wh}
                  rows={stockByWarehouseAndArticle}
                />
              ))}
            </div>
          )}
        </div>

        {/* Recent movements */}
        <div className="lg:col-span-2 card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-800">Pergerakan Terbaru</h3>
            <span className="badge-muted text-[10px]">{movements?.total ?? 0} total</span>
          </div>
          {(movements?.data ?? []).length === 0 ? (
            <div className="text-center py-8 text-sm text-slate-300">Belum ada pergerakan</div>
          ) : (
            <div>
              {(movements?.data ?? []).map(m => <MovementRow key={m.id} m={m} />)}
            </div>
          )}
        </div>
      </div>

    </div>
  )
}
