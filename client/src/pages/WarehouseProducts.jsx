import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { warehousesApi, productsApi } from '../api'
import SearchBar from '../components/SearchBar'
import { Pagination } from '../components/Table'
import {
  ArrowLeft, ChevronRight, Package, Hash, Layers, ImageIcon,
  Warehouse, ArrowUpDown, ArrowUp, ArrowDown, TrendingUp,
  BoxesIcon, Banknote,
} from 'lucide-react'

// ── Helpers ───────────────────────────────────────────────────────────────────

function priceRange(skus = []) {
  const prices = skus.map(s => Number(s.price || 0)).filter(Boolean)
  if (!prices.length) return null
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  const fmt = n => `Rp ${n.toLocaleString('id-ID')}`
  return min === max ? fmt(min) : `${fmt(min)} – ${fmt(max)}`
}

// Estimate nilai stok using warehouse-specific totalStock × average SKU price
function nilaiStok(product) {
  const skus = product.ProductSKUs ?? []
  const total = Number(product.totalStock ?? 0)
  if (!skus.length || !total) return 0
  const avgPrice = skus.reduce((s, k) => s + Number(k.price || 0), 0) / skus.length
  return total * avgPrice
}

// ── Sort header ───────────────────────────────────────────────────────────────

function SortTh({ label, col, sort, onSort, className = '' }) {
  const active = sort.col === col
  return (
    <th
      className={`th cursor-pointer select-none hover:text-slate-700 group ${className}`}
      onClick={() => onSort(col)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {active
          ? sort.dir === 'asc'
            ? <ArrowUp size={11} className="text-brand" />
            : <ArrowDown size={11} className="text-brand" />
          : <ArrowUpDown size={11} className="text-slate-300 group-hover:text-slate-400" />}
      </span>
    </th>
  )
}

// ── Variant cell ──────────────────────────────────────────────────────────────

function VariantCell({ types = [] }) {
  if (!types.length) return <span className="text-slate-300 text-xs">—</span>
  return (
    <div className="space-y-1">
      {types.map(t => (
        <div key={t.id} className="flex items-start gap-1.5 flex-wrap">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-0.5 shrink-0 w-14 truncate">{t.name}</span>
          <div className="flex flex-wrap gap-1">
            {(t.ProductVariantOptions ?? []).map(o => (
              <span key={o.id} className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">{o.value}</span>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, sub, color = 'slate' }) {
  const colors = {
    slate:   'bg-slate-50 text-slate-500 border-slate-200',
    brand:   'bg-brand/5 text-brand border-brand/20',
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-200',
    amber:   'bg-amber-50 text-amber-600 border-amber-200',
  }
  return (
    <div className="card px-5 py-4 flex items-center gap-4">
      <div className={`w-10 h-10 rounded-xl border flex items-center justify-center flex-shrink-0 ${colors[color]}`}>
        <Icon size={18} />
      </div>
      <div>
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">{label}</p>
        <p className="text-xl font-bold text-slate-800 leading-tight">{value}</p>
        {sub && <p className="text-[11px] text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function WarehouseProducts() {
  const { id }   = useParams()
  const navigate = useNavigate()

  const [search, setSearch] = useState('')
  const [page, setPage]     = useState(1)
  const [sort, setSort]     = useState({ col: 'name', dir: 'asc' })

  const handleSort = (col) => {
    setSort(s => ({ col, dir: s.col === col && s.dir === 'asc' ? 'desc' : 'asc' }))
    setPage(1)
  }

  const { data: warehouse, isLoading: whLoading } = useQuery({
    queryKey: ['warehouse', id],
    queryFn:  () => warehousesApi.get(id),
  })

  const { data, isLoading: prodLoading } = useQuery({
    queryKey: ['products', { page, name: search, WarehouseId: id, sortBy: sort.col, sortOrder: sort.dir }],
    queryFn:  () => productsApi.list({
      page, limit: 20, name: search,
      WarehouseId: id,
      sortBy:    sort.col,
      sortOrder: sort.dir,
    }),
    enabled: !!id,
  })

  const rows       = data?.data ?? []
  const pagination = data?.pagination

  // Compute aggregate stats from loaded rows
  const totalProduk = pagination?.total ?? 0
  const totalStok   = rows.reduce((s, p) => s + Number(p.totalStock ?? 0), 0)
  const totalNilai  = rows.reduce((s, p) => s + nilaiStok(p), 0)

  const isLoading = whLoading || prodLoading

  return (
    <div className="min-h-screen bg-canvas">
      {/* ── Sticky Header ──────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 bg-white border-b border-slate-200 shadow-sm">
        <div className="flex items-center gap-3 px-6 h-14">
          <Link to="/warehouses" className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-700 transition-colors flex-shrink-0">
            <ArrowLeft size={15} /> Warehouses
          </Link>
          <ChevronRight size={14} className="text-slate-200" />
          <span className="text-sm text-slate-500 truncate">{warehouse?.name ?? '…'}</span>
          <ChevronRight size={14} className="text-slate-200" />
          <span className="text-sm font-bold text-slate-800">Produk</span>
        </div>
      </div>

      <div className="max-w-screen-xl mx-auto px-6 py-6 space-y-5">

        {/* ── Warehouse info ──────────────────────────────────────── */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-brand/10 flex items-center justify-center">
              <Warehouse size={20} className="text-brand" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-800">{warehouse?.name ?? '…'}</h1>
              {warehouse?.location && (
                <p className="text-sm text-slate-400 mt-0.5">{warehouse.location}</p>
              )}
            </div>
          </div>
          <button
            onClick={() => navigate(`/products?WarehouseId=${id}`)}
            className="btn-secondary text-sm hidden"
          />
        </div>

        {/* ── Stat cards ─────────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-4">
          <StatCard icon={Package}  label="Total Produk" value={totalProduk.toLocaleString('id-ID')} sub="jenis produk di gudang ini" color="brand" />
          <StatCard icon={BoxesIcon ?? Package} label="Total Stok" value={totalStok.toLocaleString('id-ID')} sub="unit (semua SKU)" color="amber" />
          <StatCard icon={Banknote ?? Package}  label="Total Nilai Stok" value={`Rp ${totalNilai.toLocaleString('id-ID')}`} sub="estimasi nilai inventori" color="emerald" />
        </div>

        {/* ── Product table ───────────────────────────────────────── */}
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50">
            <SearchBar
              value={search}
              onChange={v => { setSearch(v); setPage(1) }}
              placeholder="Cari produk di gudang ini…"
              className="max-w-sm"
            />
          </div>

          {isLoading ? (
            <div className="py-20 flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-brand/30 border-t-brand rounded-full animate-spin" />
            </div>
          ) : rows.length === 0 ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3 text-center px-6">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center">
                <Package size={24} className="text-slate-300" />
              </div>
              <p className="text-sm font-semibold text-slate-500">
                {search ? 'Tidak ada produk yang cocok' : 'Belum ada produk di gudang ini'}
              </p>
              <p className="text-xs text-slate-400 max-w-xs">
                {search
                  ? 'Coba kata kunci lain.'
                  : 'Produk akan muncul di sini setelah ada stock-in ke gudang ini.'}
              </p>
            </div>
          ) : (
            <>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100">
                    <SortTh label="Produk"   col="name"       sort={sort} onSort={handleSort} />
                    <th className="th">Kategori</th>
                    <th className="th">Variant</th>
                    <th className="th">SKU</th>
                    <th className="th">Harga</th>
                    <SortTh label="Stok"     col="totalStock" sort={sort} onSort={handleSort} className="text-right" />
                    <th className="th text-right">Nilai Stok</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(p => {
                    const skus   = p.ProductSKUs ?? []
                    const types  = p.ProductVariantTypes ?? []
                    const range  = priceRange(skus)
                    const nilai  = nilaiStok(p)
                    const stock  = Number(p.totalStock ?? 0)
                    const skuCnt = skus.length

                    return (
                      <tr
                        key={p.id}
                        className="group border-b border-slate-100 last:border-0 hover:bg-slate-50/70 transition-colors cursor-pointer"
                        onClick={() => navigate(`/products/${p.id}`)}
                      >
                        {/* Produk */}
                        <td className="td">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-lg overflow-hidden border border-slate-200 flex-shrink-0 bg-slate-100">
                              {p.imageUrl
                                ? <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
                                : <div className="w-full h-full flex items-center justify-center text-slate-300"><ImageIcon size={13} /></div>}
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-slate-800 truncate text-sm">{p.name}</p>
                              <p className="text-xs text-slate-400">{p.unit}</p>
                            </div>
                          </div>
                        </td>

                        {/* Kategori */}
                        <td className="td">
                          {p.Category
                            ? <span className="badge-teal">{p.Category.name}</span>
                            : <span className="text-slate-300 text-xs">—</span>}
                        </td>

                        {/* Variant */}
                        <td className="td max-w-[180px]"><VariantCell types={types} /></td>

                        {/* SKU */}
                        <td className="td">
                          {skuCnt > 0
                            ? <div className="flex items-center gap-1"><Hash size={10} className="text-slate-400" /><span className="text-sm font-bold text-slate-600">{skuCnt}</span></div>
                            : <span className="text-xs text-amber-500 font-medium bg-amber-50 px-2 py-0.5 rounded border border-amber-100">Belum ada</span>}
                        </td>

                        {/* Harga */}
                        <td className="td">
                          {range
                            ? <span className="text-sm font-semibold text-slate-700 tabular-nums">{range}</span>
                            : <span className="text-slate-300 text-xs">—</span>}
                        </td>

                        {/* Stok */}
                        <td className="td text-right">
                          <span className={`text-sm font-bold tabular-nums ${stock === 0 ? 'text-red-500' : stock < 10 ? 'text-amber-500' : 'text-slate-800'}`}>
                            {stock.toLocaleString('id-ID')}
                          </span>
                          <span className="text-xs text-slate-400 ml-1">{p.unit || 'unit'}</span>
                        </td>

                        {/* Nilai */}
                        <td className="td text-right">
                          {nilai > 0
                            ? <span className="text-sm font-semibold text-emerald-700 tabular-nums">Rp {nilai.toLocaleString('id-ID')}</span>
                            : <span className="text-slate-300 text-xs">—</span>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>

              <Pagination pagination={pagination} onPageChange={setPage} />
            </>
          )}
        </div>

      </div>
    </div>
  )
}
