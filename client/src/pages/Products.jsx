import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { productsApi, categoriesApi, articlesApi, warehousesApi } from '../api'
import SearchBar from '../components/SearchBar'
import { Pagination } from '../components/Table'
import toast from 'react-hot-toast'
import {
  Plus, Trash2, ImageIcon, Filter, ChevronRight,
  Package, Hash, Layers, ArrowUpDown, ArrowUp, ArrowDown,
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

function nilaiStok(skus = []) {
  const v = skus.reduce((s, k) => s + Number(k.price || 0) * Number(k.qty || 0), 0)
  return v > 0 ? v : null
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

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ filtered, onAdd }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
        <Package size={28} className="text-slate-300" />
      </div>
      <h3 className="text-sm font-bold text-slate-700 mb-1">
        {filtered ? 'Tidak ada hasil' : 'Belum ada produk'}
      </h3>
      <p className="text-xs text-slate-400 max-w-xs">
        {filtered ? 'Coba ubah filter atau kata kunci pencarian.' : 'Mulai dengan menambahkan produk pertama Anda.'}
      </p>
      {!filtered && (
        <button onClick={onAdd} className="btn-primary mt-5 text-sm">
          <Plus size={14} /> Tambah Produk Pertama
        </button>
      )}
    </div>
  )
}

// ── Variant cell ──────────────────────────────────────────────────────────────

function VariantCell({ types = [] }) {
  if (!types.length) return <span className="text-slate-300 text-xs">—</span>
  return (
    <div className="space-y-1.5">
      {types.map(t => (
        <div key={t.id} className="flex items-start gap-1.5 flex-wrap">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-0.5 shrink-0 w-14 truncate">{t.name}</span>
          <div className="flex flex-wrap gap-1">
            {(t.ProductVariantOptions ?? []).map(o => (
              <span key={o.id} className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                {o.value}
              </span>
            ))}
            {!(t.ProductVariantOptions?.length) && <span className="text-[10px] text-slate-300 italic">kosong</span>}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Product Row ───────────────────────────────────────────────────────────────

function ProductRow({ product, onDelete, onClick }) {
  const skus   = product.ProductSKUs ?? []
  const types  = product.ProductVariantTypes ?? []
  const range  = priceRange(skus)
  const nilai  = nilaiStok(skus)
  const stock  = Number(product.totalStock ?? 0)
  const skuCnt = skus.length

  return (
    <tr
      className="group border-b border-slate-100 last:border-0 hover:bg-slate-50/70 transition-colors cursor-pointer"
      onClick={onClick}
    >
      {/* Produk */}
      <td className="td">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl overflow-hidden border border-slate-200 flex-shrink-0 bg-slate-100">
            {product.imageUrl
              ? <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
              : <div className="w-full h-full flex items-center justify-center text-slate-300"><ImageIcon size={14} /></div>}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-slate-800 truncate leading-tight text-sm">{product.name}</p>
            <p className="text-xs text-slate-400 mt-0.5">{product.unit}</p>
          </div>
        </div>
      </td>

      {/* Kategori */}
      <td className="td">
        {product.Category
          ? <span className="badge-teal">{product.Category.name}</span>
          : <span className="text-slate-300 text-xs">—</span>}
      </td>

      {/* Variant */}
      <td className="td max-w-[200px]"><VariantCell types={types} /></td>

      {/* SKU */}
      <td className="td">
        {skuCnt > 0
          ? <div className="flex items-center gap-1 text-slate-600"><Hash size={10} className="text-slate-400" /><span className="text-sm font-bold">{skuCnt}</span></div>
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
        {skuCnt > 0
          ? <div>
              <span className={`text-sm font-bold tabular-nums ${stock === 0 ? 'text-red-500' : stock < 10 ? 'text-amber-500' : 'text-slate-800'}`}>
                {stock.toLocaleString('id-ID')}
              </span>
              <span className="text-xs text-slate-400 ml-1">{product.unit || 'unit'}</span>
            </div>
          : <span className="text-slate-300 text-xs">—</span>}
      </td>

      {/* Nilai Stok */}
      <td className="td text-right">
        {nilai
          ? <span className="text-sm font-semibold text-emerald-700 tabular-nums">Rp {nilai.toLocaleString('id-ID')}</span>
          : <span className="text-slate-300 text-xs">—</span>}
      </td>

      {/* Actions */}
      <td className="td">
        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={e => { e.stopPropagation(); onDelete(product) }}
            className="p-1.5 rounded-lg text-slate-300 hover:text-red-400 hover:bg-red-50 transition-colors"
          >
            <Trash2 size={13} />
          </button>
          <ChevronRight size={14} className="text-slate-200" />
        </div>
      </td>
    </tr>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function Products() {
  const navigate = useNavigate()
  const qc       = useQueryClient()

  const [page, setPage]             = useState(1)
  const [search, setSearch]         = useState('')
  const [catFilter, setCat]         = useState('')
  const [artFilter, setArt]         = useState('')
  const [whFilter, setWh]           = useState('')
  const [sort, setSort]             = useState({ col: 'name', dir: 'asc' })
  const [delModal, setDelModal]     = useState(null)

  const handleSort = (col) => {
    setSort(s => ({ col, dir: s.col === col && s.dir === 'asc' ? 'desc' : 'asc' }))
    setPage(1)
  }

  const { data, isLoading } = useQuery({
    queryKey: ['products', { page, name: search, CategoryId: catFilter, ArticleId: artFilter, WarehouseId: whFilter, sortBy: sort.col, sortOrder: sort.dir }],
    queryFn:  () => productsApi.list({
      page, limit: 15, name: search,
      CategoryId:  catFilter  || undefined,
      ArticleId:   artFilter  || undefined,
      WarehouseId: whFilter   || undefined,
      sortBy:      sort.col,
      sortOrder:   sort.dir,
    }),
  })

  const { data: cats } = useQuery({ queryKey: ['categories', { limit: 200 }], queryFn: () => categoriesApi.list({ limit: 200 }) })
  const { data: arts } = useQuery({ queryKey: ['articles',   { limit: 200 }], queryFn: () => articlesApi.list({ limit: 200 }) })
  const { data: whs  } = useQuery({ queryKey: ['warehouses', { limit: 200 }], queryFn: () => warehousesApi.list({ limit: 200 }) })

  const catOptions = cats?.data ?? []
  const artOptions = arts?.data ?? []
  const whOptions  = whs?.data  ?? []

  const del = useMutation({
    mutationFn: id => productsApi.remove(id),
    onSuccess: () => { qc.invalidateQueries(['products']); toast.success('Produk dihapus'); setDelModal(null) },
    onError:   e  => toast.error(e.response?.data?.message || 'Gagal menghapus'),
  })

  const rows         = data?.data ?? []
  const pagination   = data?.pagination
  const activeFilters = [catFilter, artFilter, whFilter].filter(Boolean).length
  const isFiltered   = !!(search || catFilter || artFilter || whFilter)

  return (
    <div className="px-6 py-6 max-w-screen-xl mx-auto">

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Products</h1>
          <p className="text-sm text-slate-400 mt-0.5">{pagination?.total ?? 0} produk terdaftar</p>
        </div>
        <button onClick={() => navigate('/products/new')} className="btn-primary">
          <Plus size={15} /> Tambah Produk
        </button>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <SearchBar
          value={search}
          onChange={v => { setSearch(v); setPage(1) }}
          placeholder="Cari nama produk…"
          className="flex-1 min-w-48"
        />

        <div className="flex items-center gap-2 flex-wrap">
          <Filter size={13} className={activeFilters ? 'text-brand' : 'text-slate-400'} />

          <select className="select w-40" value={catFilter} onChange={e => { setCat(e.target.value); setPage(1) }}>
            <option value="">Semua kategori</option>
            {catOptions.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>

          <select className="select w-40" value={artFilter} onChange={e => { setArt(e.target.value); setPage(1) }}>
            <option value="">Semua artikel</option>
            {artOptions.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>

          <select className="select w-44" value={whFilter} onChange={e => { setWh(e.target.value); setPage(1) }}>
            <option value="">Semua gudang</option>
            {whOptions.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>

          {activeFilters > 0 && (
            <button
              onClick={() => { setCat(''); setArt(''); setWh(''); setPage(1) }}
              className="text-xs text-slate-400 hover:text-slate-700 underline whitespace-nowrap"
            >
              Reset filter
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="py-20 text-center">
            <div className="w-6 h-6 border-2 border-brand/30 border-t-brand rounded-full animate-spin mx-auto" />
          </div>
        ) : rows.length === 0 ? (
          <EmptyState filtered={isFiltered} onAdd={() => navigate('/products/new')} />
        ) : (
          <>
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100">
                  <SortTh label="Produk"     col="name"       sort={sort} onSort={handleSort} />
                  <th className="th">Kategori</th>
                  <th className="th">Variant</th>
                  <th className="th">SKU</th>
                  <th className="th">Harga</th>
                  <SortTh label="Stok"       col="totalStock" sort={sort} onSort={handleSort} className="text-right" />
                  <th className="th text-right">Nilai Stok</th>
                  <th className="th w-10" />
                </tr>
              </thead>
              <tbody>
                {rows.map(p => (
                  <ProductRow
                    key={p.id}
                    product={p}
                    onClick={() => navigate(`/products/${p.id}`)}
                    onDelete={product => setDelModal(product)}
                  />
                ))}
              </tbody>
            </table>

            <Pagination pagination={pagination} onPageChange={setPage} />
          </>
        )}
      </div>

      {/* Delete confirm */}
      {delModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 animate-fade-in">
            <div className="w-11 h-11 rounded-xl bg-red-50 flex items-center justify-center mb-4">
              <Trash2 size={20} className="text-red-500" />
            </div>
            <h3 className="text-base font-bold text-slate-800 mb-1">Hapus Produk?</h3>
            <p className="text-sm text-slate-500 mb-5">
              <span className="font-semibold text-slate-700">"{delModal.name}"</span> beserta semua variant dan SKU-nya akan dihapus permanen.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setDelModal(null)} className="btn-secondary flex-1 justify-center">Batal</button>
              <button onClick={() => del.mutate(delModal.id)} disabled={del.isPending} className="btn-danger flex-1 justify-center">
                {del.isPending ? 'Menghapus…' : 'Ya, Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
