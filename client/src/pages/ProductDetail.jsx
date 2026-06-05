import { useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { productsApi, productSkusApi } from '../api'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import QrModal from '../components/QrModal'
import {
  ArrowLeft, Trash2, ChevronRight, ImageIcon, Loader2,
  Hash, Layers, Pencil, QrCode, Package, Tag, Plus,
} from 'lucide-react'

// ── SKU Table read-only ───────────────────────────────────────────────────────

function SkuTableView({ productId, productName }) {
  const navigate = useNavigate()
  const [qrSku, setQrSku] = useState(null)
  const { hasPermission } = useAuth()
  const canEdit = hasPermission('inventory.product.edit') || hasPermission('inventory.manage')

  const { data: skus = [], isLoading } = useQuery({
    queryKey: ['product-skus', productId],
    queryFn:  () => productSkusApi.list(productId),
  })

  if (isLoading) return (
    <div className="flex items-center gap-2 text-sm text-slate-400 py-4">
      <Loader2 size={14} className="animate-spin" /> Memuat SKU…
    </div>
  )

  if (!skus.length) return (
    <div className="text-center py-10 rounded-xl border-2 border-dashed border-slate-200">
      <Hash size={28} className="mx-auto text-slate-300 mb-3" />
      <p className="text-sm font-semibold text-slate-500">Belum ada SKU</p>
      <p className="text-xs text-slate-400 mt-1 mb-4">
        Tentukan variant produk terlebih dahulu, lalu buat SKU untuk setiap kombinasi.
      </p>
      {canEdit && (
        <button
          type="button"
          onClick={() => navigate(`/products/${productId}/edit`)}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-brand text-white text-sm font-medium hover:bg-brand/90 transition-colors"
        >
          <Plus size={14} /> Buat SKU
        </button>
      )}
    </div>
  )

  const totalQty   = skus.reduce((s, k) => s + Number(k.qty || 0), 0)
  const totalNilai = skus.reduce((s, k) => s + Number(k.qty || 0) * Number(k.price || 0), 0)

  const variantLabel = (sku) => {
    const opts = sku.ProductVariantOptions || []
    if (!opts.length) return <span className="text-slate-400 italic text-xs">Tanpa variant</span>
    return (
      <div className="flex flex-wrap gap-1">
        {opts.map((o, i) => (
          <span key={o.id} className="inline-flex items-center gap-1 text-xs">
            {i > 0 && <span className="text-slate-300 mx-0.5">/</span>}
            <span className="px-1.5 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-600">{o.value}</span>
            <span className="text-slate-300 text-[10px]">({o.ProductVariantType?.name})</span>
          </span>
        ))}
      </div>
    )
  }

  return (
    <>
      <div className="rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="th">Variant</th>
              <th className="th">SKU Code</th>
              <th className="th text-right">Harga</th>
              <th className="th text-right">Stok</th>
              <th className="th text-right">Nilai Stok</th>
              <th className="th w-10" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {skus.map(sku => {
              const nilai = Number(sku.qty || 0) * Number(sku.price || 0)
              return (
                <tr key={sku.id} className="group hover:bg-slate-50/60 transition-colors">
                  <td className="td">{variantLabel(sku)}</td>
                  <td className="td">
                    <span className="font-mono text-xs text-slate-700 bg-slate-100 px-2 py-0.5 rounded">{sku.sku_code}</span>
                  </td>
                  <td className="td text-right">
                    <span className="text-sm font-semibold text-slate-700 tabular-nums">
                      Rp {Number(sku.price || 0).toLocaleString('id-ID')}
                    </span>
                  </td>
                  <td className="td text-right">
                    <span className={`text-sm font-bold tabular-nums ${Number(sku.qty) === 0 ? 'text-red-500' : Number(sku.qty) < 5 ? 'text-amber-500' : 'text-slate-800'}`}>
                      {Number(sku.qty || 0).toLocaleString('id-ID')}
                    </span>
                  </td>
                  <td className="td text-right">
                    <span className="text-sm tabular-nums text-emerald-700 font-semibold">
                      Rp {nilai.toLocaleString('id-ID')}
                    </span>
                  </td>
                  <td className="td">
                    <button
                      type="button"
                      onClick={() => setQrSku(sku)}
                      className="p-1.5 rounded text-slate-400 hover:text-violet-500 hover:bg-violet-50 transition-all"
                      title="QR Code"
                    >
                      <QrCode size={13} />
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot className="bg-slate-50/80 border-t border-slate-200">
            <tr>
              <td colSpan={2} className="px-4 py-2.5 text-xs font-semibold text-slate-500">{skus.length} SKU</td>
              <td className="px-4 py-2.5 text-xs text-slate-400 text-right">—</td>
              <td className="px-4 py-2.5 text-xs font-bold text-slate-700 text-right tabular-nums">{totalQty.toLocaleString('id-ID')}</td>
              <td className="px-4 py-2.5 text-xs font-bold text-emerald-700 text-right tabular-nums">Rp {totalNilai.toLocaleString('id-ID')}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      {qrSku && <QrModal sku={qrSku} skuName={productName} onClose={() => setQrSku(null)} />}
    </>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function ProductDetail() {
  const { id }   = useParams()
  const navigate = useNavigate()
  const qc       = useQueryClient()
  const { hasPermission } = useAuth()
  const canEdit   = hasPermission('inventory.product.edit')   || hasPermission('inventory.manage')
  const canDelete = hasPermission('inventory.product.delete') || hasPermission('inventory.manage')

  const { data: product, isLoading } = useQuery({
    queryKey: ['product', id],
    queryFn:  () => productsApi.get(id),
  })

  const del = useMutation({
    mutationFn: () => productsApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] })
      toast.success('Produk dihapus')
      navigate('/products', { replace: true })
    },
    onError: e => toast.error(e.response?.data?.message || 'Gagal menghapus'),
  })

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 size={24} className="animate-spin text-slate-300" />
    </div>
  )

  if (!product) return (
    <div className="flex flex-col items-center justify-center h-64 gap-3">
      <Package size={32} className="text-slate-300" />
      <p className="text-slate-400 text-sm">Produk tidak ditemukan</p>
      <Link to="/products" className="btn-secondary text-sm"><ArrowLeft size={14} /> Kembali</Link>
    </div>
  )

  const totalStock = Number(product.totalStock ?? 0)
  const variants   = product.ProductVariantTypes ?? []
  const skus       = product.ProductSKUs ?? []

  return (
    <div className="min-h-screen bg-canvas">
      {/* ── Sticky Header ──────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 bg-white border-b border-slate-200 shadow-sm">
        <div className="flex items-center gap-4 px-6 h-14">
          <Link to="/products" className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-700 transition-colors flex-shrink-0">
            <ArrowLeft size={15} /> Products
          </Link>
          <ChevronRight size={14} className="text-slate-200" />
          <h1 className="text-sm font-bold text-slate-800 flex-1 truncate">{product.name}</h1>

          {(canDelete || canEdit) && (
            <div className="flex items-center gap-2">
              {canDelete && (
                <button
                  type="button"
                  onClick={() => { if (confirm(`Hapus "${product.name}"? Tindakan ini tidak bisa dibatalkan.`)) del.mutate() }}
                  disabled={del.isPending}
                  className="btn-secondary text-red-500 hover:bg-red-50 hover:border-red-200 text-sm"
                >
                  {del.isPending ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  Hapus
                </button>
              )}
              {canEdit && (
                <button
                  type="button"
                  onClick={() => navigate(`/products/${id}/edit`)}
                  className="btn-primary text-sm"
                >
                  <Pencil size={14} /> Ubah
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Content ────────────────────────────────────────────────── */}
      <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">

        {/* ── Info card ────────────────────────────────────────────── */}
        <div className="card px-6 py-6">
          <div className="flex gap-6">
            {/* Photo */}
            <div className="w-40 h-40 rounded-2xl overflow-hidden border border-slate-200 bg-slate-50 flex-shrink-0">
              {product.imageUrl ? (
                <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-slate-300">
                  <ImageIcon size={28} />
                  <span className="text-[11px]">Tidak ada foto</span>
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0 space-y-4 pt-1">
              <div>
                <h2 className="text-2xl font-bold text-slate-800 leading-tight">{product.name}</h2>
                <span className="inline-flex items-center mt-1.5 px-2 py-0.5 rounded bg-slate-100 text-slate-500 font-medium text-xs">
                  {product.unit}
                </span>
              </div>

              <div className="flex flex-wrap gap-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">Tipe</p>
                  {product.Category
                    ? <span className="badge-teal">{product.Category.name}</span>
                    : <span className="text-slate-300 text-xs">—</span>}
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">Koleksi</p>
                  {product.Article
                    ? <span className="badge-muted">{product.Article.name}</span>
                    : <span className="text-slate-300 text-xs">—</span>}
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">Total Stok</p>
                  <span className={`text-sm font-bold tabular-nums ${totalStock === 0 ? 'text-red-500' : totalStock < 10 ? 'text-amber-500' : 'text-slate-800'}`}>
                    {totalStock.toLocaleString('id-ID')} {product.unit}
                  </span>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">SKU</p>
                  <span className="text-sm font-bold text-slate-800">{skus.length}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Variants read-only ───────────────────────────────────── */}
        <div className="card px-6 py-5">
          <div className="flex items-center gap-3 mb-4 pb-4 border-b border-slate-100">
            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 flex-shrink-0">
              <Layers size={15} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">Variant Produk</h3>
              <p className="text-xs text-slate-400 mt-0.5">Tipe dan opsi variant yang tersedia</p>
            </div>
          </div>

          {variants.length === 0 ? (
            <p className="text-sm text-slate-400 italic py-2">Produk ini tidak memiliki variant.</p>
          ) : (
            <div className="space-y-3">
              {variants.map(t => (
                <div key={t.id} className="flex items-start gap-3">
                  <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400 pt-0.5 w-20 shrink-0">{t.name}</span>
                  <div className="flex flex-wrap gap-1.5">
                    {t.ProductVariantOptions?.map(o => (
                      <span key={o.id} className="px-2.5 py-1 rounded-full text-xs font-semibold bg-violet-50 text-violet-700 border border-violet-100">
                        {o.value}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── SKU table read-only ──────────────────────────────────── */}
        <div className="card px-6 py-5">
          <div className="flex items-center gap-3 mb-4 pb-4 border-b border-slate-100">
            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 flex-shrink-0">
              <Hash size={15} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">SKU & Harga</h3>
              <p className="text-xs text-slate-400 mt-0.5">Daftar SKU beserta harga dan stok</p>
            </div>
          </div>
          <SkuTableView productId={id} productName={product?.name} />
        </div>

      </div>
    </div>
  )
}
