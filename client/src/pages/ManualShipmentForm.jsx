import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Plus, Trash2, ShoppingCart, Gift, Search, X, Package } from 'lucide-react'
import toast from 'react-hot-toast'
import { manualShipmentsApi, shipmentCategoriesApi, productsApi, productSkusApi } from '../api'

const fmtRp = n => 'Rp ' + Number(n || 0).toLocaleString('id-ID')

// ── Product Picker Modal ──────────────────────────────────────────────────────
function ProductPickerModal({ onAdd, onClose }) {
  const [search, setSearch]       = useState('')
  const [selected, setSelected]   = useState(null)
  const [selectedSku, setSelectedSku] = useState('')
  const [qty, setQty]             = useState(1)
  const [unitPrice, setUnitPrice] = useState('')

  const { data: productsRes, isLoading } = useQuery({
    queryKey: ['products-picker', search],
    queryFn:  () => productsApi.list({ search, limit: 50 }),
  })
  const products = productsRes?.data ?? []

  const { data: skusData } = useQuery({
    queryKey: ['skus-picker', selected?.id],
    queryFn:  () => productSkusApi.list(selected.id),
    enabled:  !!selected?.id,
  })
  const skus = Array.isArray(skusData) ? skusData : (skusData?.data ?? [])

  useEffect(() => { setSelectedSku(''); setUnitPrice('') }, [selected])

  // Auto-fill harga dari SKU saat varian dipilih
  useEffect(() => {
    if (!selectedSku) return
    const sku = skus.find(s => String(s.id) === String(selectedSku))
    if (sku?.price) setUnitPrice(String(Math.round(Number(sku.price))))
  }, [selectedSku, skus])

  const handleAdd = () => {
    if (!selected) return toast.error('Pilih produk terlebih dahulu')
    if (skus.length > 0 && !selectedSku) return toast.error('Pilih varian produk')
    if (!qty || qty <= 0) return toast.error('Quantity harus > 0')

    const sku = skus.find(s => String(s.id) === String(selectedSku))
    const variantLabel = sku?.ProductVariantOptions?.length
      ? sku.ProductVariantOptions.map(o => o.value).join(' / ')
      : null

    onAdd({
      productId:    selected.id,
      productSkuId: sku?.id ?? null,
      productName:  selected.name,
      variantName:  variantLabel,
      productImageUrl: selected.imageUrl || null,
      sku:          sku?.sku_code ?? null,
      quantity:     Number(qty),
      unitPrice:    Number(String(unitPrice).replace(/\D/g, '')) || 0,
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold text-slate-800">Pilih Produk</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>

        <div className="flex flex-col md:flex-row overflow-hidden flex-1">
          {/* Product list */}
          <div className="flex flex-col w-full md:w-1/2 border-r overflow-hidden">
            <div className="p-3 border-b">
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Cari nama produk..."
                  className="input pl-8 text-sm h-9 py-0 w-full"
                  autoFocus
                />
              </div>
            </div>
            <div className="overflow-y-auto flex-1">
              {isLoading && <p className="p-4 text-sm text-slate-400">Memuat...</p>}
              {!isLoading && products.length === 0 && <p className="p-4 text-sm text-slate-400">Produk tidak ditemukan</p>}
              {products.map(p => (
                <button
                  key={p.id}
                  onClick={() => setSelected(p)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-slate-50 transition-colors border-b border-slate-50 ${selected?.id === p.id ? 'bg-red-50' : ''}`}
                >
                  {p.imageUrl
                    ? <img src={p.imageUrl} alt={p.name} className="w-10 h-10 rounded object-cover flex-shrink-0 border border-slate-100" />
                    : <div className="w-10 h-10 rounded bg-slate-100 flex items-center justify-center flex-shrink-0"><Package size={16} className="text-slate-400" /></div>
                  }
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-slate-800 truncate">{p.name}</div>
                    <div className="text-xs text-slate-400">{p.Category?.name ?? '—'}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Right: config */}
          <div className="flex flex-col w-full md:w-1/2 p-4 gap-4 overflow-y-auto">
            {!selected && (
              <p className="text-sm text-slate-400 text-center mt-8">← Pilih produk di sebelah kiri</p>
            )}
            {selected && (
              <>
                <div className="flex items-center gap-3">
                  {selected.imageUrl
                    ? <img src={selected.imageUrl} alt={selected.name} className="w-14 h-14 rounded-lg object-cover border" />
                    : <div className="w-14 h-14 rounded-lg bg-slate-100 flex items-center justify-center"><Package size={20} className="text-slate-400" /></div>
                  }
                  <div>
                    <div className="font-semibold text-slate-800">{selected.name}</div>
                    <div className="text-xs text-slate-400">{selected.Category?.name}</div>
                  </div>
                </div>

                {skus.length > 0 && (
                  <div>
                    <label className="label">Varian *</label>
                    <select value={selectedSku} onChange={e => setSelectedSku(e.target.value)} className="input text-sm">
                      <option value="">-- Pilih Varian --</option>
                      {skus.map(s => {
                        const label = s.ProductVariantOptions?.length
                          ? s.ProductVariantOptions.map(o => o.value).join(' / ')
                          : s.sku_code
                        return <option key={s.id} value={s.id}>{label}</option>
                      })}
                    </select>
                  </div>
                )}

                <div>
                  <label className="label">
                    Harga Satuan
                    {unitPrice && <span className="ml-1 text-xs text-indigo-500 font-normal">(dari data produk)</span>}
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={unitPrice}
                    onChange={e => setUnitPrice(e.target.value)}
                    placeholder="0"
                    className="input text-sm"
                  />
                </div>

                <div>
                  <label className="label">Quantity *</label>
                  <input
                    type="number"
                    min="1"
                    value={qty}
                    onChange={e => setQty(e.target.value)}
                    className="input text-sm"
                  />
                </div>

                <div className="bg-slate-50 rounded-lg p-3 text-sm">
                  <div className="flex justify-between text-slate-600">
                    <span>Subtotal</span>
                    <span className="font-semibold">{fmtRp(Number(String(unitPrice).replace(/\D/g, '')) * Number(qty))}</span>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="p-4 border-t flex justify-end gap-2">
          <button onClick={onClose} className="btn-secondary">Batal</button>
          <button onClick={handleAdd} className="btn-primary" disabled={!selected}>
            Tambah ke Daftar
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Form ─────────────────────────────────────────────────────────────────
const EXPEDITION_PRESET_FALLBACK = [
  'JNE', 'J&T Express', 'SiCepat', 'AnterAja', 'Ninja Express',
  'Lion Parcel', 'Gosend', 'Grab Express', 'IDExpress', 'RPX',
]

export default function ManualShipmentForm() {
  const { id }   = useParams()
  const isEdit   = !!id
  const navigate = useNavigate()
  const qc       = useQueryClient()

  const [type, setType]                     = useState('sales')
  const [shipmentCategoryId, setCategoryId] = useState('')
  const [buyerName, setBuyerName]           = useState('')
  const [buyerAddress, setBuyerAddress]     = useState('')
  const [buyerPhone, setBuyerPhone]         = useState('')
  const [recipientInfo, setRecipientInfo]   = useState('')
  const [shippingCost, setShippingCost]     = useState('')
  const [expeditionName, setExpeditionName] = useState('')
  const [expedCustom, setExpedCustom]       = useState('')
  const [expedCustomMode, setExpedCustomMode] = useState(false)
  const [notes, setNotes]                   = useState('')
  const [items, setItems]                   = useState([])
  const [showPicker, setShowPicker]         = useState(false)
  const [newCategory, setNewCategory]       = useState('')
  const [addingCat, setAddingCat]           = useState(false)

  // Load for edit
  const { data: existingRes, isLoading: loadingExisting } = useQuery({
    queryKey: ['manual-shipment', id],
    queryFn:  () => manualShipmentsApi.get(id),
    enabled:  isEdit,
  })

  useEffect(() => {
    if (!existingRes?.data) return
    const d = existingRes.data
    setType(d.type)
    setCategoryId(d.shipmentCategoryId ? String(d.shipmentCategoryId) : '')
    setBuyerName(d.buyerName || '')
    setBuyerAddress(d.buyerAddress || '')
    setBuyerPhone(d.buyerPhone || '')
    setRecipientInfo(d.recipientInfo || '')
    setShippingCost(d.shippingCost ? String(d.shippingCost) : '')
    setNotes(d.notes || '')
    if (d.expeditionName) {
      if (EXPEDITION_PRESET_FALLBACK.includes(d.expeditionName)) {
        setExpeditionName(d.expeditionName)
      } else {
        setExpedCustomMode(true)
        setExpedCustom(d.expeditionName)
      }
    }
    setItems(d.items?.map(i => ({
      productId:       i.productId,
      productSkuId:    i.productSkuId,
      productName:     i.productName,
      variantName:     i.variantName,
      productImageUrl: i.productImageUrl,
      sku:             i.sku,
      quantity:        i.quantity,
      unitPrice:       Number(i.unitPrice),
    })) ?? [])
  }, [existingRes])

  const { data: categoriesRes } = useQuery({
    queryKey: ['shipment-categories'],
    queryFn:  () => shipmentCategoriesApi.list(),
  })
  const categories = categoriesRes?.data ?? []

  const { data: expedPresets } = useQuery({
    queryKey: ['expedition-presets'],
    queryFn:  () => manualShipmentsApi.expeditionPresets(),
  })
  const presets = expedPresets?.data ?? EXPEDITION_PRESET_FALLBACK

  const createCatMutation = useMutation({
    mutationFn: () => shipmentCategoriesApi.create({ name: newCategory.trim() }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['shipment-categories'] })
      setCategoryId(String(res.data.id))
      setNewCategory('')
      setAddingCat(false)
      toast.success('Kategori ditambahkan')
    },
    onError: () => toast.error('Gagal menambah kategori'),
  })

  const saveMutation = useMutation({
    mutationFn: (payload) => isEdit
      ? manualShipmentsApi.update(id, payload)
      : manualShipmentsApi.create(payload),
    onSuccess: (res) => {
      toast.success(isEdit ? 'Shipping diperbarui' : 'Shipping berhasil dibuat')
      qc.invalidateQueries({ queryKey: ['manual-shipments'] })
      navigate(`/shipping-manual/${res.data.id}`)
    },
    onError: (err) => toast.error(err?.response?.data?.message ?? 'Gagal menyimpan'),
  })

  const subtotal = items.reduce((s, i) => s + (i.unitPrice * i.quantity), 0)
  const cost     = Number(String(shippingCost).replace(/\D/g, '')) || 0
  const total    = subtotal + cost

  const handleAddItem = (item) => setItems(prev => [...prev, item])
  const handleRemoveItem = (idx) => setItems(prev => prev.filter((_, i) => i !== idx))
  const handleQtyChange  = (idx, val) => setItems(prev => prev.map((it, i) => i === idx ? { ...it, quantity: Number(val) } : it))
  const handlePriceChange = (idx, val) => setItems(prev => prev.map((it, i) => i === idx ? { ...it, unitPrice: Number(String(val).replace(/\D/g, '')) } : it))

  const handleSubmit = (e) => {
    e.preventDefault()
    if (items.length === 0) return toast.error('Tambahkan minimal satu produk')
    if (type === 'sales' && !buyerName.trim()) return toast.error('Nama pembeli wajib diisi')

    const finalExpedition = expedCustomMode ? expedCustom.trim() : expeditionName
    saveMutation.mutate({
      type,
      shipmentCategoryId: type === 'non_sales' && shipmentCategoryId ? Number(shipmentCategoryId) : undefined,
      buyerName:    type === 'sales' ? buyerName.trim()    : undefined,
      buyerAddress: type === 'sales' ? buyerAddress.trim() : undefined,
      buyerPhone:   type === 'sales' ? buyerPhone.trim()   : undefined,
      recipientInfo: type === 'non_sales' ? recipientInfo.trim() : undefined,
      shippingCost: cost,
      expeditionName: finalExpedition || undefined,
      notes: notes.trim() || undefined,
      items: items.map(i => ({
        productId:    i.productId,
        productSkuId: i.productSkuId || undefined,
        quantity:     i.quantity,
        unitPrice:    i.unitPrice,
      })),
    })
  }

  if (isEdit && loadingExisting) {
    return <div className="flex items-center justify-center h-64 text-slate-400">Memuat...</div>
  }

  return (
    <div className="px-4 md:px-6 py-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="btn-ghost p-2 rounded-lg">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-xl font-bold text-slate-800">{isEdit ? 'Edit Shipping Manual' : 'Buat Shipping Manual'}</h1>
          <p className="text-sm text-slate-400">Isi detail transaksi pengiriman</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left col */}
          <div className="space-y-5">
            {/* Type */}
            <div className="card p-5 space-y-4">
              <h2 className="font-semibold text-slate-700 text-sm">Tipe Pengiriman</h2>
              <div className="flex gap-3">
                {[
                  { value: 'sales',     label: 'Sales',     icon: ShoppingCart, desc: 'Ada transaksi jual beli' },
                  { value: 'non_sales', label: 'Non-Sales', icon: Gift,         desc: 'Endorse, giveaway, dll' },
                ].map(t => (
                  <button
                    type="button"
                    key={t.value}
                    disabled={isEdit}
                    onClick={() => setType(t.value)}
                    className={`flex-1 flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                      type === t.value
                        ? 'border-red-500 bg-red-50 text-red-700'
                        : 'border-slate-200 hover:border-slate-300 text-slate-500'
                    } ${isEdit ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    <t.icon size={22} />
                    <span className="font-semibold text-sm">{t.label}</span>
                    <span className="text-xs opacity-70">{t.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Info pembeli / penerima */}
            <div className="card p-5 space-y-4">
              <h2 className="font-semibold text-slate-700 text-sm">
                {type === 'sales' ? 'Info Pembeli' : 'Info Penerima'}
              </h2>

              {type === 'sales' && (
                <>
                  <div>
                    <label className="label">Nama Pembeli *</label>
                    <input value={buyerName} onChange={e => setBuyerName(e.target.value)} className="input" placeholder="Nama lengkap pembeli" required />
                  </div>
                  <div>
                    <label className="label">Alamat Pengiriman *</label>
                    <textarea value={buyerAddress} onChange={e => setBuyerAddress(e.target.value)} className="input min-h-[80px] resize-none" placeholder="Alamat lengkap..." />
                  </div>
                  <div>
                    <label className="label">Nomor HP</label>
                    <input value={buyerPhone} onChange={e => setBuyerPhone(e.target.value)} className="input" placeholder="08xxxxxxxxxx" />
                  </div>
                </>
              )}

              {type === 'non_sales' && (
                <>
                  <div>
                    <label className="label">Kategori</label>
                    <div className="flex gap-2">
                      <select
                        value={shipmentCategoryId}
                        onChange={e => setCategoryId(e.target.value)}
                        className="input flex-1"
                      >
                        <option value="">-- Pilih Kategori --</option>
                        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                      <button
                        type="button"
                        onClick={() => setAddingCat(v => !v)}
                        className="btn-secondary px-3 flex-shrink-0"
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                    {addingCat && (
                      <div className="flex gap-2 mt-2">
                        <input
                          value={newCategory}
                          onChange={e => setNewCategory(e.target.value)}
                          placeholder="Nama kategori baru..."
                          className="input flex-1 text-sm"
                          onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), newCategory.trim() && createCatMutation.mutate())}
                        />
                        <button
                          type="button"
                          onClick={() => newCategory.trim() && createCatMutation.mutate()}
                          disabled={createCatMutation.isPending || !newCategory.trim()}
                          className="btn-primary text-xs px-3"
                        >
                          Simpan
                        </button>
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="label">Penerima / Keterangan</label>
                    <textarea value={recipientInfo} onChange={e => setRecipientInfo(e.target.value)} className="input min-h-[80px] resize-none" placeholder="Siapa yang menerima / untuk apa..." />
                  </div>
                </>
              )}
            </div>

            {/* Info pengiriman */}
            <div className="card p-5 space-y-4">
              <h2 className="font-semibold text-slate-700 text-sm">Info Pengiriman</h2>
              <div>
                <label className="label">Ekspedisi</label>
                {!expedCustomMode ? (
                  <div className="flex gap-2">
                    <select value={expeditionName} onChange={e => setExpeditionName(e.target.value)} className="input flex-1">
                      <option value="">-- Pilih Ekspedisi --</option>
                      {presets.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                    <button type="button" onClick={() => setExpedCustomMode(true)} className="btn-secondary text-xs px-3 flex-shrink-0">
                      Custom
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <input value={expedCustom} onChange={e => setExpedCustom(e.target.value)} placeholder="Nama ekspedisi..." className="input flex-1" />
                    <button type="button" onClick={() => { setExpedCustomMode(false); setExpedCustom('') }} className="btn-secondary text-xs px-3 flex-shrink-0">
                      Preset
                    </button>
                  </div>
                )}
              </div>
              <div>
                <label className="label">Catatan</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} className="input min-h-[70px] resize-none" placeholder="Catatan tambahan..." />
              </div>
            </div>
          </div>

          {/* Right col: products */}
          <div className="space-y-5">
            <div className="card p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-slate-700 text-sm">Produk</h2>
                <button type="button" onClick={() => setShowPicker(true)} className="btn-primary flex items-center gap-1.5 text-xs py-1.5 px-3">
                  <Plus size={13} /> Tambah Produk
                </button>
              </div>

              {items.length === 0 && (
                <div className="flex flex-col items-center justify-center py-10 text-slate-400 border-2 border-dashed border-slate-200 rounded-xl">
                  <Package size={28} className="mb-2 opacity-40" />
                  <p className="text-sm">Belum ada produk ditambahkan</p>
                  <button type="button" onClick={() => setShowPicker(true)} className="mt-3 text-xs text-red-500 hover:underline">
                    + Tambah produk
                  </button>
                </div>
              )}

              {items.length > 0 && (
                <div className="space-y-2">
                  {items.map((item, idx) => (
                    <div key={idx} className="flex gap-3 items-start bg-slate-50 rounded-lg p-3">
                      {item.productImageUrl
                        ? <img src={item.productImageUrl} alt={item.productName} className="w-12 h-12 rounded-lg object-cover border border-slate-200 flex-shrink-0" />
                        : <div className="w-12 h-12 rounded-lg bg-slate-200 flex items-center justify-center flex-shrink-0"><Package size={16} className="text-slate-400" /></div>
                      }
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-slate-800 truncate">{item.productName}</div>
                        {item.variantName && <div className="text-xs text-slate-500">{item.variantName}</div>}
                        {item.sku && <div className="text-xs text-slate-400 font-mono">{item.sku}</div>}
                        <div className="flex gap-2 mt-2 items-center">
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-slate-400">Qty</span>
                            <input
                              type="number" min="1" value={item.quantity}
                              onChange={e => handleQtyChange(idx, e.target.value)}
                              className="input w-16 text-sm h-7 py-0 text-center"
                            />
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-slate-400">@</span>
                            <input
                              type="number" min="0" value={item.unitPrice}
                              onChange={e => handlePriceChange(idx, e.target.value)}
                              className="input w-28 text-sm h-7 py-0"
                              placeholder="0"
                            />
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        <button type="button" onClick={() => handleRemoveItem(idx)} className="text-slate-300 hover:text-red-500 transition-colors">
                          <Trash2 size={14} />
                        </button>
                        <span className="text-xs font-semibold text-slate-700 mt-auto">
                          {fmtRp(item.unitPrice * item.quantity)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Pricing summary */}
              {items.length > 0 && (
                <div className="border-t pt-4 space-y-2">
                  <div className="flex justify-between text-sm text-slate-600">
                    <span>Subtotal</span>
                    <span>{fmtRp(subtotal)}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm text-slate-600">
                    <span>Ongkir</span>
                    <input
                      type="number" min="0" value={shippingCost}
                      onChange={e => setShippingCost(e.target.value)}
                      className="input w-36 text-sm h-7 py-0 text-right"
                      placeholder="0"
                    />
                  </div>
                  <div className="flex justify-between text-base font-bold text-slate-800 border-t pt-2">
                    <span>Total</span>
                    <span>{fmtRp(total)}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Submit */}
            <div className="flex gap-3 justify-end">
              <button type="button" onClick={() => navigate(-1)} className="btn-secondary">
                Batal
              </button>
              <button
                type="submit"
                disabled={saveMutation.isPending || items.length === 0}
                className="btn-primary min-w-[140px]"
              >
                {saveMutation.isPending ? 'Menyimpan...' : isEdit ? 'Simpan Perubahan' : 'Buat Shipping'}
              </button>
            </div>
          </div>
        </div>
      </form>

      {showPicker && <ProductPickerModal onAdd={handleAddItem} onClose={() => setShowPicker(false)} />}
    </div>
  )
}
