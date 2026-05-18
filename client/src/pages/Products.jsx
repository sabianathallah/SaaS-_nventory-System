import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { productsApi, categoriesApi, articlesApi, warehousesApi, productSkusApi } from '../api'
import SearchBar from '../components/SearchBar'
import SearchableSelect from '../components/SearchableSelect'
import { Pagination } from '../components/Table'
import QrModal from '../components/QrModal'
import toast from 'react-hot-toast'
import { exportExcel } from '../utils/exportExcel'
import {
  Plus, Trash2, ImageIcon, Filter, ChevronRight, ChevronDown,
  Package, ArrowUpDown, ArrowUp, ArrowDown, QrCode, Pencil,
  Loader2, Tag, FileSpreadsheet, Building2,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useSelectedCompany } from '../context/SelectedCompanyContext'
import { useCompanyGuard } from '../hooks/useCompanyGuard'
import CompanyRequiredBanner from '../components/CompanyRequiredBanner'

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = n => `Rp ${Number(n).toLocaleString('id-ID')}`

function priceRange(skus = []) {
  const prices = skus.map(s => Number(s.price || 0)).filter(Boolean)
  if (!prices.length) return null
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  return min === max ? fmt(min) : `${fmt(min)} – ${fmt(max)}`
}

function variantLabel(sku) {
  const opts = sku.ProductVariantOptions ?? []
  if (!opts.length) return null
  return opts.map(o => o.value).join(' / ')
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
          ? sort.dir === 'asc' ? <ArrowUp size={11} className="text-brand" /> : <ArrowDown size={11} className="text-brand" />
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

// ── SKU sub-rows (lazy) ───────────────────────────────────────────────────────

function SkuRows({ product, onOpenQr }) {
  const skuCount = product.ProductSKUs?.length ?? 0

  const { data: skus, isLoading } = useQuery({
    queryKey: ['product-skus', product.id],
    queryFn:  () => productSkusApi.list(product.id),
    staleTime: 60_000,
  })

  if (isLoading) {
    return (
      <tr>
        <td colSpan={8} className="px-4 py-3 bg-slate-50/60 border-b border-slate-100">
          <div className="flex items-center gap-2 pl-12 text-xs text-slate-400">
            <Loader2 size={12} className="animate-spin" /> Memuat SKU…
          </div>
        </td>
      </tr>
    )
  }

  if (!skus?.length) {
    return (
      <tr>
        <td colSpan={8} className="px-4 py-3 bg-slate-50/60 border-b border-slate-100">
          <p className="pl-12 text-xs text-slate-400 italic">Belum ada SKU.</p>
        </td>
      </tr>
    )
  }

  return (
    <>
      {/* SKU header */}
      <tr className="bg-slate-50/80">
        <td colSpan={8} className="pt-0 pb-0">
          <div className="ml-14 mr-4 mt-2">
            <div className="grid text-[10px] font-bold uppercase tracking-widest text-slate-400 border-b border-slate-200 pb-1.5"
              style={{ gridTemplateColumns: '1fr 160px 90px 140px 36px' }}>
              <span className="pl-1">SKU / Variant</span>
              <span>Kode SKU</span>
              <span className="text-right">Stok</span>
              <span className="text-right">Harga</span>
              <span />
            </div>
          </div>
        </td>
      </tr>

      {/* SKU data rows */}
      {skus.map((sku, idx) => {
        const label  = variantLabel(sku)
        const isLast = idx === skus.length - 1
        const stock  = Number(sku.qty ?? 0)
        return (
          <tr key={sku.id} className="bg-slate-50/60 hover:bg-slate-100/60 transition-colors">
            <td colSpan={8} className={`py-0 ${isLast ? 'pb-2 border-b border-slate-200' : ''}`}>
              <div
                className="ml-14 mr-4 grid items-center py-2 border-b border-slate-100 last:border-0"
                style={{ gridTemplateColumns: '1fr 160px 90px 140px 36px' }}
              >
                {/* Name + variant */}
                <div className="pl-1 min-w-0">
                  {label
                    ? <div className="flex items-center gap-1.5 flex-wrap">
                        {(sku.ProductVariantOptions ?? []).map(o => (
                          <span key={o.id} className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-white border border-slate-200 text-slate-600">
                            {o.ProductVariantType?.name && <span className="text-slate-400 mr-0.5">{o.ProductVariantType.name}:</span>}
                            {o.value}
                          </span>
                        ))}
                      </div>
                    : <span className="text-xs text-slate-400 italic">No variant</span>}
                </div>

                {/* SKU code */}
                <div>
                  <span className="font-mono text-xs text-slate-500 bg-white border border-slate-200 rounded px-1.5 py-0.5">
                    {sku.sku_code}
                  </span>
                </div>

                {/* Stock */}
                <div className="text-right">
                  <span className={`text-xs font-bold tabular-nums ${stock === 0 ? 'text-red-400' : stock < 5 ? 'text-amber-500' : 'text-slate-700'}`}>
                    {stock.toLocaleString('id-ID')}
                  </span>
                  <span className="text-[10px] text-slate-400 ml-0.5">{product.unit || 'unit'}</span>
                </div>

                {/* Price */}
                <div className="text-right">
                  {sku.price
                    ? <span className="text-xs font-semibold text-slate-700 tabular-nums">{fmt(sku.price)}</span>
                    : <span className="text-xs text-slate-300">—</span>}
                </div>

                {/* QR */}
                <div className="flex justify-end">
                  <button
                    onClick={() => onOpenQr({ sku: sku, skuName: label ?? product.name })}
                    className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-white transition-colors"
                    title="Print QR"
                  >
                    <QrCode size={13} />
                  </button>
                </div>
              </div>
            </td>
          </tr>
        )
      })}
    </>
  )
}

// ── Product Row ───────────────────────────────────────────────────────────────

function ProductRow({ product, expanded, onToggle, onDelete, onNavigate, onOpenQr, disabled }) {
  const skus   = product.ProductSKUs ?? []
  const range  = priceRange(skus)
  const stock  = Number(product.totalStock ?? 0)
  const skuCnt = skus.length

  const handleRowClick = () => onToggle()
  const handleQrClick = (e) => {
    e.stopPropagation()
    if (skuCnt === 0) {
      toast('Belum ada SKU — buat SKU terlebih dahulu untuk menggunakan QR.', { icon: '⚠️' })
    }
  }

  return (
    <>
      <tr
        className="group border-b border-slate-100 hover:bg-slate-50/70 transition-colors"
        style={{ borderBottomWidth: expanded ? 0 : undefined }}
      >
        {/* Expand toggle */}
        <td className="td w-10 pr-0">
          <button
            onClick={handleRowClick}
            className="w-6 h-6 rounded flex items-center justify-center transition-colors text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 cursor-pointer"
          >
            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
        </td>

        {/* Product */}
        <td className="td cursor-pointer" onClick={handleRowClick}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg overflow-hidden border border-slate-200 flex-shrink-0 bg-slate-100">
              {product.imageUrl
                ? <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
                : <div className="w-full h-full flex items-center justify-center text-slate-300"><ImageIcon size={13} /></div>}
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-slate-800 truncate leading-tight text-sm">{product.name}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">{product.unit}</p>
            </div>
          </div>
        </td>

        {/* Tipe */}
        <td className="td w-32">
          {product.Category
            ? <span className="badge-teal">{product.Category.name}</span>
            : <span className="text-slate-300 text-xs">—</span>}
        </td>

        {/* Koleksi */}
        <td className="td w-32">
          {product.Article
            ? <span className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold bg-violet-50 text-violet-700 border border-violet-100">{product.Article.name}</span>
            : <span className="text-slate-300 text-xs">—</span>}
        </td>

        {/* SKU count */}
        <td className="td w-24">
          {skuCnt > 0
            ? <div className="flex items-center gap-1">
                <Tag size={10} className="text-slate-400 flex-shrink-0" />
                <span className="text-sm font-bold text-slate-700">{skuCnt}</span>
                <span className="text-xs text-slate-400">SKU</span>
              </div>
            : <span className="text-xs text-amber-500 font-medium bg-amber-50 px-2 py-0.5 rounded border border-amber-100">Belum ada</span>}
        </td>

        {/* Harga */}
        <td className="td w-44">
          {range
            ? <span className="text-sm font-semibold text-slate-700 tabular-nums">{range}</span>
            : <span className="text-slate-300 text-xs">—</span>}
        </td>

        {/* Stok */}
        <td className="td w-28 text-right">
          {skuCnt > 0
            ? <div>
                <span className={`text-sm font-bold tabular-nums ${stock === 0 ? 'text-red-500' : stock < 10 ? 'text-amber-500' : 'text-slate-800'}`}>
                  {stock.toLocaleString('id-ID')}
                </span>
                <span className="text-xs text-slate-400 ml-1">{product.unit || 'unit'}</span>
              </div>
            : <span className="text-slate-300 text-xs">—</span>}
        </td>

        {/* Actions */}
        <td className="td w-20">
          <div className="flex items-center justify-end gap-1">
            {skuCnt === 0 && (
              <button
                type="button"
                onClick={handleQrClick}
                className="p-1.5 rounded-lg transition-colors text-slate-300 hover:text-amber-500 hover:bg-amber-50"
                title="Belum ada SKU"
              >
                <QrCode size={12} />
              </button>
            )}
            {!disabled && (
              <>
                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); onNavigate() }}
                  className="p-1.5 rounded-lg text-slate-300 hover:text-slate-600 hover:bg-slate-100 transition-colors opacity-0 group-hover:opacity-100"
                  title="Edit produk"
                >
                  <Pencil size={12} />
                </button>
                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); onDelete(product) }}
                  className="p-1.5 rounded-lg text-slate-300 hover:text-red-400 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
                  title="Hapus produk"
                >
                  <Trash2 size={12} />
                </button>
              </>
            )}
          </div>
        </td>
      </tr>

      {/* Expanded rows */}
      {expanded && (
        skuCnt > 0
          ? <SkuRows product={product} onOpenQr={onOpenQr} />
          : <tr>
              <td colSpan={8} className="border-b border-slate-100 bg-slate-50/60">
                <div className="ml-14 mr-4 py-4 flex items-center gap-4">
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-slate-500">Belum ada SKU</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Tambahkan variant dan buat SKU melalui halaman edit produk.</p>
                  </div>
                  <button
                    type="button"
                    onClick={e => { e.stopPropagation(); onNavigate() }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand text-white text-xs font-medium hover:bg-brand/90 transition-colors flex-shrink-0"
                  >
                    <Plus size={11} /> Buat SKU
                  </button>
                </div>
              </td>
            </tr>
      )}
    </>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function Products() {
  const navigate = useNavigate()
  const qc       = useQueryClient()
  const { isSuperAdmin, hasPermission } = useAuth()
  const { selectedCompany } = useSelectedCompany()
  const { needsCompany } = useCompanyGuard()
  const blocked    = isSuperAdmin && !selectedCompany
  const canManage  = hasPermission('inventory.manage')

  const [page, setPage]         = useState(1)
  const [search, setSearch]     = useState('')
  const [catFilter, setCat]     = useState('')
  const [artFilter, setArt]     = useState('')
  const [whFilter, setWh]       = useState('')
  const [sort, setSort]         = useState({ col: 'name', dir: 'asc' })
  const [delModal, setDelModal] = useState(null)
  const [expanded, setExpanded] = useState(new Set())
  const [qrTarget, setQrTarget] = useState(null)

  const handleSort = (col) => {
    setSort(s => ({ col, dir: s.col === col && s.dir === 'asc' ? 'desc' : 'asc' }))
    setPage(1)
  }

  const toggleExpand = (id) => {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
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
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['products'] }); toast.success('Produk dihapus'); setDelModal(null) },
    onError:   e  => toast.error(e.response?.data?.message || 'Gagal menghapus'),
  })

  const rows         = data?.data ?? []
  const pagination   = data?.pagination
  const activeFilters = [catFilter, artFilter, whFilter].filter(Boolean).length
  const isFiltered   = !!(search || catFilter || artFilter || whFilter)

  const [exporting, setExporting] = useState(false)
  const handleExportExcel = async () => {
    setExporting(true)
    try {
      const result = await productsApi.list({
        limit: 9999, name: search,
        CategoryId: catFilter || undefined,
        ArticleId:  artFilter || undefined,
        WarehouseId: whFilter || undefined,
        sortBy: sort.col, sortOrder: sort.dir,
      })
      const headers = ['No', 'Nama Produk', 'Unit', 'Tipe', 'Koleksi', 'Total SKU', 'Total Stok', 'Harga Min (Rp)', 'Harga Max (Rp)']
      const rows = result.data.map((p, i) => {
        const skus   = p.ProductSKUs ?? []
        const prices = skus.map(s => Number(s.price || 0)).filter(Boolean)
        return [
          i + 1, p.name, p.unit ?? '', p.Category?.name ?? '', p.Article?.name ?? '',
          skus.length, Number(p.totalStock ?? 0),
          prices.length ? Math.min(...prices) : '',
          prices.length ? Math.max(...prices) : '',
        ]
      })
      exportExcel(`produk-${new Date().toISOString().slice(0, 10)}`, { headers, rows, sheetName: 'Produk' })
    } catch {
      toast.error('Gagal export Excel')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="px-6 py-6 max-w-screen-xl mx-auto">
      {needsCompany && <div className="mb-4"><CompanyRequiredBanner action="menambah produk" /></div>}

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Products</h1>
          <p className="text-sm text-slate-400 mt-0.5">{pagination?.total ?? 0} produk terdaftar</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleExportExcel} disabled={exporting} className="btn-secondary text-sm flex items-center gap-1.5">
            {exporting ? <Loader2 size={14} className="animate-spin" /> : <FileSpreadsheet size={14} />}
            Export Excel
          </button>
          {!blocked && canManage && (
            <button onClick={() => navigate('/products/new')} className="btn-primary">
              <Plus size={15} /> Tambah Produk
            </button>
          )}
        </div>
      </div>

      {blocked && (
        <div className="flex items-center gap-3 px-4 py-3.5 rounded-xl border border-amber-200 bg-amber-50 text-amber-800 mb-4">
          <Building2 size={16} className="text-amber-500 flex-shrink-0" />
          <p className="text-sm font-medium">
            Pilih perusahaan di bagian atas terlebih dahulu untuk bisa menambah, mengubah, atau menghapus produk.
          </p>
        </div>
      )}

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <SearchBar
          value={search}
          onChange={v => { setSearch(v); setPage(1) }}
          placeholder="Cari nama / kode SKU…"
          className="flex-1 min-w-48"
        />
        <div className="flex items-center gap-2 flex-wrap">
          <Filter size={13} className={activeFilters ? 'text-brand' : 'text-slate-400'} />
          <SearchableSelect
            value={catFilter}
            onChange={v => { setCat(v); setPage(1) }}
            options={[{ value: '', label: 'Semua tipe' }, ...catOptions.map(c => ({ value: c.id, label: c.name }))]}
            placeholder="Semua tipe"
            className="w-40"
          />
          <SearchableSelect
            value={artFilter}
            onChange={v => { setArt(v); setPage(1) }}
            options={[{ value: '', label: 'Semua koleksi' }, ...artOptions.map(a => ({ value: a.id, label: a.name }))]}
            placeholder="Semua koleksi"
            className="w-40"
          />
          <SearchableSelect
            value={whFilter}
            onChange={v => { setWh(v); setPage(1) }}
            options={[{ value: '', label: 'Semua gudang' }, ...whOptions.map(w => ({ value: w.id, label: w.name }))]}
            placeholder="Semua gudang"
            className="w-44"
          />
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
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1000px]">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="th w-10 pr-0" />
                    <SortTh label="Produk"  col="name"       sort={sort} onSort={handleSort} />
                    <th className="th w-32">Tipe</th>
                    <th className="th w-32">Koleksi</th>
                    <th className="th w-24">SKU</th>
                    <th className="th w-44">Harga</th>
                    <SortTh label="Stok"    col="totalStock" sort={sort} onSort={handleSort} className="w-28 text-right" />
                    <th className="th w-16" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map(p => (
                    <ProductRow
                      key={p.id}
                      product={p}
                      expanded={expanded.has(p.id)}
                      onToggle={() => toggleExpand(p.id)}
                      onNavigate={() => navigate(`/products/${p.id}`)}
                      onDelete={product => setDelModal(product)}
                      disabled={blocked || !canManage}
                      onOpenQr={setQrTarget}
                    />
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination pagination={pagination} onPageChange={setPage} />
          </>
        )}
      </div>

      {/* QR Modal */}
      {qrTarget && (
        <QrModal
          sku={qrTarget.sku}
          skuName={qrTarget.skuName}
          onClose={() => setQrTarget(null)}
        />
      )}

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
