import { useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, ArrowRight, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'
import { stockTransfersApi, warehousesApi, productsApi, productSkusApi, stocksApi } from '../api'
import PageHeader from '../components/PageHeader'
import SearchableSelect from '../components/SearchableSelect'
import { useAuth } from '../context/AuthContext'

const TRANSFER_TYPES = [
  { value: 'TRANSFER',            label: 'Transfer Biasa' },
  { value: 'QC_REJECT_SEMENTARA', label: 'QC Reject → Gudang Sementara' },
  { value: 'QC_REJECT_PERMANEN',  label: 'QC Reject → Tidak Bisa Diperbaiki' },
  { value: 'LAINNYA',             label: 'Lainnya' },
]

const TYPE_STYLE = {
  TRANSFER:              'bg-blue-50 text-blue-700 border-blue-100',
  QC_REJECT_SEMENTARA:   'bg-amber-50 text-amber-700 border-amber-100',
  QC_REJECT_PERMANEN:    'bg-red-50 text-red-700 border-red-100',
  LAINNYA:               'bg-slate-50 text-slate-600 border-slate-200',
}

export default function TransferDetail() {
  const { id } = useParams()
  const isNew  = id === 'new'
  const navigate  = useNavigate()
  const qc        = useQueryClient()
  const { isSuperAdmin, hasPermission } = useAuth()

  // ── form state (only used when creating) ───────────────────────────────────
  const [form, setForm] = useState({
    date:            new Date().toISOString().slice(0, 10),
    transferType:    'TRANSFER',
    fromWarehouseId: '',
    toWarehouseId:   '',
    note:            '',
  })
  const [items, setItems] = useState([])
  const [itemRow, setItemRow] = useState({ productId: '', productSkuId: '', qty: 1 })

  // ── existing transfer (view mode) ──────────────────────────────────────────
  const { data: existing, isLoading } = useQuery({
    queryKey: ['transfer', id],
    queryFn:  () => stockTransfersApi.get(id),
    enabled:  !isNew,
  })
  const transfer = existing?.data

  // ── lookup data ────────────────────────────────────────────────────────────
  const { data: warehousesRes } = useQuery({
    queryKey: ['warehouses', { limit: 100 }],
    queryFn:  () => warehousesApi.list({ limit: 100 }),
  })
  const warehouses = warehousesRes?.data ?? []

  const { data: productsRes } = useQuery({
    queryKey: ['products', { limit: 300 }],
    queryFn:  () => productsApi.list({ limit: 300 }),
  })
  const products = productsRes?.data ?? []

  const { data: skusData } = useQuery({
    queryKey: ['skus', itemRow.productId],
    queryFn:  () => productSkusApi.list(itemRow.productId),
    enabled:  !!itemRow.productId,
  })
  const skus = skusData ?? []

  // stock available at fromWarehouse for selected SKU
  const activeFromId = isNew ? form.fromWarehouseId : transfer?.fromWarehouseId
  const { data: stockRes } = useQuery({
    queryKey: ['stock-at', activeFromId, itemRow.productSkuId],
    queryFn:  async () => {
      if (!activeFromId || !itemRow.productSkuId) return null
      const sku = skus.find(s => String(s.id) === String(itemRow.productSkuId))
      if (!sku) return null
      const res = await stocksApi.list({ WarehouseId: activeFromId, ProductId: sku.ProductId, limit: 1 })
      return res?.data?.[0]?.quantity ?? 0
    },
    enabled: !!activeFromId && !!itemRow.productSkuId,
  })
  const availableStock = stockRes ?? 0

  // ── mutations ──────────────────────────────────────────────────────────────
  const createTransfer = useMutation({
    mutationFn: () => stockTransfersApi.create({
      ...form,
      fromWarehouseId: Number(form.fromWarehouseId),
      toWarehouseId:   Number(form.toWarehouseId),
      items,
    }),
    onSuccess: (res) => {
      toast.success('Transfer berhasil dibuat')
      qc.invalidateQueries({ queryKey: ['transfers'] })
      navigate(`/transfers/${res.data.id}`)
    },
    onError: (err) => toast.error(err?.response?.data?.message ?? 'Gagal membuat transfer'),
  })

  const deleteTransfer = useMutation({
    mutationFn: () => stockTransfersApi.destroy(id),
    onSuccess: () => {
      toast.success('Transfer dihapus, stok dikembalikan')
      qc.invalidateQueries({ queryKey: ['transfers'] })
      qc.invalidateQueries({ queryKey: ['stocks'] })
      qc.invalidateQueries({ queryKey: ['movements'] })
      navigate('/transfers')
    },
    onError: (err) => toast.error(err?.response?.data?.message ?? 'Gagal menghapus transfer'),
  })

  // ── item helpers ───────────────────────────────────────────────────────────
  function addItem() {
    if (!itemRow.productSkuId) return toast.error('Pilih SKU produk')
    if (!itemRow.qty || Number(itemRow.qty) <= 0) return toast.error('Qty harus > 0')
    if (Number(itemRow.qty) > availableStock) return toast.error(`Stok tidak cukup (tersedia: ${availableStock})`)

    const sku = skus.find(s => String(s.id) === String(itemRow.productSkuId))
    const product = products.find(p => String(p.id) === String(itemRow.productId))
    const variantLabel = sku?.ProductVariantOptions?.map(o => o.value).join(' / ') || sku?.sku_code || ''

    setItems(prev => [...prev, {
      productSkuId: Number(itemRow.productSkuId),
      qty:          Number(itemRow.qty),
      _productName: product?.name ?? '',
      _variantLabel: variantLabel,
      _available:   availableStock,
    }])
    setItemRow({ productId: '', productSkuId: '', qty: 1 })
  }

  function removeItem(idx) {
    setItems(prev => prev.filter((_, i) => i !== idx))
  }

  function handleSubmit() {
    if (!form.fromWarehouseId) return toast.error('Pilih gudang asal')
    if (!form.toWarehouseId)   return toast.error('Pilih gudang tujuan')
    if (form.fromWarehouseId === form.toWarehouseId) return toast.error('Gudang asal dan tujuan tidak boleh sama')
    if (!form.date)            return toast.error('Isi tanggal')
    if (!items.length)         return toast.error('Tambahkan minimal satu item')
    createTransfer.mutate()
  }

  const canDelete = isSuperAdmin || hasPermission('stock.transfer.delete') || hasPermission('stock.transfer.manage')

  const skuOptions = useMemo(() => skus.map(s => {
    const opts  = s.ProductVariantOptions ?? []
    const label = opts.length ? opts.map(o => o.value).join(' / ') : s.sku_code
    return { value: s.id, label }
  }), [skus])

  // ── render ─────────────────────────────────────────────────────────────────
  if (!isNew && isLoading) {
    return (
      <div className="px-6 py-6">
        <div className="h-8 w-48 bg-slate-100 rounded animate-pulse mb-6" />
        <div className="card p-6 space-y-3">
          {[1,2,3].map(i => <div key={i} className="h-5 bg-slate-100 rounded animate-pulse" />)}
        </div>
      </div>
    )
  }

  if (!isNew && !transfer) {
    return (
      <div className="px-6 py-6 text-center text-slate-400">Transfer tidak ditemukan.</div>
    )
  }

  // ── VIEW MODE ──────────────────────────────────────────────────────────────
  if (!isNew) {
    const typeStyle = TYPE_STYLE[transfer.transferType] ?? TYPE_STYLE.LAINNYA
    const typeLabel = TRANSFER_TYPES.find(t => t.value === transfer.transferType)?.label ?? transfer.transferType

    return (
      <div className="px-6 py-6 space-y-6">
        <PageHeader
          title="Detail Transfer Stok"
          subtitle={`#${transfer.id} · ${new Date(transfer.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}`}
          action={
            canDelete && (
              <button
                onClick={() => { if (window.confirm('Hapus transfer ini? Semua perubahan stok akan dikembalikan.')) deleteTransfer.mutate() }}
                disabled={deleteTransfer.isPending}
                className="btn-danger flex items-center gap-2"
              >
                <Trash2 size={14} />
                {deleteTransfer.isPending ? 'Menghapus…' : 'Hapus Transfer'}
              </button>
            )
          }
        />

        <div className="card p-5 space-y-4">
          <div className="flex flex-wrap gap-6">
            <div>
              <p className="text-xs text-slate-400 mb-1">Tipe Transfer</p>
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${typeStyle}`}>
                {typeLabel}
              </span>
            </div>
            <div>
              <p className="text-xs text-slate-400 mb-1">Tanggal</p>
              <p className="text-sm font-semibold text-slate-800">
                {new Date(transfer.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-400 mb-1">Dibuat oleh</p>
              <p className="text-sm text-slate-700">{transfer.Creator?.name ?? '—'}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-center">
              <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Gudang Asal</p>
              <p className="text-sm font-bold text-slate-800">{transfer.FromWarehouse?.name ?? '—'}</p>
            </div>
            <ArrowRight size={20} className="text-slate-400 flex-shrink-0" />
            <div className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-center">
              <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Gudang Tujuan</p>
              <p className="text-sm font-bold text-slate-800">{transfer.ToWarehouse?.name ?? '—'}</p>
            </div>
          </div>

          {transfer.note && (
            <div>
              <p className="text-xs text-slate-400 mb-1">Catatan</p>
              <p className="text-sm text-slate-600">{transfer.note}</p>
            </div>
          )}
        </div>

        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50">
            <p className="text-sm font-semibold text-slate-700">Item Transfer ({transfer.items?.length ?? 0})</p>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/30">
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500">Produk</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500">Varian / SKU</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500 w-24">Qty</th>
              </tr>
            </thead>
            <tbody>
              {(transfer.items ?? []).map(item => {
                const opts  = item.ProductSKU?.ProductVariantOptions ?? []
                const variant = opts.map(o => o.value).join(' / ') || item.ProductSKU?.sku_code || '—'
                return (
                  <tr key={item.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-slate-800">{item.ProductSKU?.Product?.name ?? '—'}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-xs text-slate-500 font-mono">{variant}</p>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="font-mono font-bold text-slate-700">{item.quantity}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  // ── CREATE MODE ────────────────────────────────────────────────────────────
  const fromWh = form.fromWarehouseId
  const toWh   = form.toWarehouseId

  return (
    <div className="px-6 py-6 space-y-6">
      <PageHeader title="Transfer Stok Baru" subtitle="Pindahkan stok antar gudang" />

      {/* Header form */}
      <div className="card p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Tanggal <span className="text-red-500">*</span></label>
            <input
              type="date"
              className="input w-full"
              value={form.date}
              onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Tipe Transfer <span className="text-red-500">*</span></label>
            <select
              className="select w-full"
              value={form.transferType}
              onChange={e => setForm(f => ({ ...f, transferType: e.target.value }))}
            >
              {TRANSFER_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Gudang Asal <span className="text-red-500">*</span></label>
            <SearchableSelect
              value={form.fromWarehouseId}
              onChange={v => setForm(f => ({ ...f, fromWarehouseId: v }))}
              options={[
                { value: '', label: '— Pilih gudang asal —' },
                ...warehouses.filter(w => !toWh || String(w.id) !== String(toWh)).map(w => ({ value: w.id, label: w.name })),
              ]}
              placeholder="Pilih gudang asal"
              className="w-full"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Gudang Tujuan <span className="text-red-500">*</span></label>
            <SearchableSelect
              value={form.toWarehouseId}
              onChange={v => setForm(f => ({ ...f, toWarehouseId: v }))}
              options={[
                { value: '', label: '— Pilih gudang tujuan —' },
                ...warehouses.filter(w => !fromWh || String(w.id) !== String(fromWh)).map(w => ({ value: w.id, label: w.name })),
              ]}
              placeholder="Pilih gudang tujuan"
              className="w-full"
            />
          </div>
        </div>

        {fromWh && toWh && (
          <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2">
            <span className="font-semibold text-slate-700">{warehouses.find(w => String(w.id) === String(fromWh))?.name}</span>
            <ArrowRight size={13} className="text-slate-400" />
            <span className="font-semibold text-slate-700">{warehouses.find(w => String(w.id) === String(toWh))?.name}</span>
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5">Catatan</label>
          <textarea
            className="input w-full resize-none"
            rows={2}
            placeholder="Catatan tambahan (opsional)…"
            value={form.note}
            onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
          />
        </div>
      </div>

      {/* Items */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-700">Item Transfer</p>
          <span className="text-xs text-slate-400">{items.length} item ditambahkan</span>
        </div>

        {/* Add item row */}
        <div className="px-4 py-3 border-b border-slate-100 bg-white">
          {!fromWh && (
            <p className="text-xs text-amber-600 flex items-center gap-1.5 mb-2">
              <AlertTriangle size={12} /> Pilih gudang asal terlebih dahulu untuk melihat stok tersedia
            </p>
          )}
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[160px]">
              <label className="block text-xs text-slate-500 mb-1">Produk</label>
              <SearchableSelect
                value={itemRow.productId}
                onChange={v => setItemRow(r => ({ ...r, productId: v, productSkuId: '' }))}
                options={[{ value: '', label: '— Pilih produk —' }, ...products.map(p => ({ value: p.id, label: p.name }))]}
                placeholder="Pilih produk"
                className="w-full"
              />
            </div>
            <div className="flex-1 min-w-[140px]">
              <label className="block text-xs text-slate-500 mb-1">Varian / SKU</label>
              <SearchableSelect
                value={itemRow.productSkuId}
                onChange={v => setItemRow(r => ({ ...r, productSkuId: v }))}
                options={[{ value: '', label: '— Pilih SKU —' }, ...skuOptions]}
                placeholder="Pilih SKU"
                className="w-full"
                disabled={!itemRow.productId}
              />
            </div>
            <div className="w-28">
              <label className="block text-xs text-slate-500 mb-1">
                Qty
                {itemRow.productSkuId && fromWh && (
                  <span className="ml-1 text-slate-400">(tersedia: <span className={availableStock === 0 ? 'text-red-500 font-semibold' : 'text-slate-600 font-medium'}>{availableStock}</span>)</span>
                )}
              </label>
              <input
                type="number" min="1" max={availableStock || undefined}
                className="input w-full"
                value={itemRow.qty}
                onChange={e => setItemRow(r => ({ ...r, qty: e.target.value }))}
              />
            </div>
            <button
              onClick={addItem}
              disabled={!itemRow.productSkuId || !fromWh || availableStock === 0}
              className="btn-primary flex items-center gap-1.5 mb-0.5"
            >
              <Plus size={14} />
              Tambah
            </button>
          </div>
        </div>

        {/* Items list */}
        {items.length > 0 ? (
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/30">
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500">Produk</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500">Varian / SKU</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500 w-24">Qty</th>
                <th className="w-12" />
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => (
                <tr key={i} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                  <td className="px-4 py-3 text-sm font-medium text-slate-800">{item._productName}</td>
                  <td className="px-4 py-3 text-xs text-slate-500 font-mono">{item._variantLabel}</td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-slate-700">{item.qty}</td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => removeItem(i)} className="text-slate-300 hover:text-red-500 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="px-4 py-8 text-center text-slate-400 text-sm">
            Belum ada item. Tambahkan item di atas.
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3">
        <button onClick={() => navigate(-1)} className="btn-secondary">
          Batal
        </button>
        <button
          onClick={handleSubmit}
          disabled={createTransfer.isPending || !items.length}
          className="btn-primary min-w-[140px]"
        >
          {createTransfer.isPending ? 'Menyimpan…' : `Simpan Transfer (${items.length} item)`}
        </button>
      </div>
    </div>
  )
}
