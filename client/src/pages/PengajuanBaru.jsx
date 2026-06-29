import { useState, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { requestApi, requestTypeApi } from '../api'
import { productsApi, productSkusApi } from '../api'
import { useAuth } from '../context/AuthContext'
import { Plus, Trash2, ChevronDown, ArrowLeft } from 'lucide-react'

function SkuPicker({ onAdd }) {
  const [search,     setSearch]     = useState('')
  const [open,       setOpen]       = useState(false)
  const [selProduct, setSelProduct] = useState(null)
  const [selSku,     setSelSku]     = useState(null)
  const [qty,        setQty]        = useState(1)
  const [note,       setNote]       = useState('')
  const inputRef = useRef(null)

  const { data: products } = useQuery({
    queryKey: ['products', { limit: 500 }],
    queryFn: () => productsApi.list({ limit: 500 }),
  })

  const { data: skus } = useQuery({
    queryKey: ['product-skus', selProduct?.id],
    queryFn: () => productSkusApi.list(selProduct.id),
    enabled: !!selProduct,
  })

  const filtered = useMemo(() => {
    const list = products?.data ?? []
    if (!search.trim()) return list
    const q = search.toLowerCase()
    return list.filter(p => p.name.toLowerCase().includes(q))
  }, [products, search])

  const skuVariantLabel = (sku) =>
    (sku.ProductVariantOptions ?? []).map(v => v.value).join(' / ')

  const handleAdd = () => {
    if (!selProduct) return toast.error('Pilih produk terlebih dahulu')
    if (!qty || Number(qty) < 1) return toast.error('Qty minimal 1')
    onAdd({
      ProductSKUId:   selSku?.id ?? null,
      productName:    selProduct.name,
      variantLabel:   selSku ? skuVariantLabel(selSku) : '',
      qty:            Number(qty),
      note,
    })
    setSearch(''); setSelProduct(null); setSelSku(null); setQty(1); setNote('')
  }

  return (
    <div className="border border-dashed border-slate-200 rounded-lg p-3 space-y-3 bg-slate-50">
      <div className="grid grid-cols-2 gap-2">
        <div className="relative">
          <label className="label mb-1 text-xs">Produk</label>
          <div className="input flex items-center gap-2 cursor-text bg-white"
               onClick={() => { setOpen(true); inputRef.current?.focus() }}>
            <input ref={inputRef} value={search}
              onChange={e => { setSearch(e.target.value); setOpen(true); setSelProduct(null); setSelSku(null) }}
              onFocus={() => setOpen(true)}
              onBlur={() => setTimeout(() => setOpen(false), 150)}
              placeholder="Cari nama produk…"
              className="flex-1 bg-transparent outline-none text-sm placeholder-slate-400" />
            <ChevronDown size={12} className="text-slate-400 flex-shrink-0" />
          </div>
          {open && filtered.length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-20 max-h-48 overflow-y-auto">
              {filtered.map(p => (
                <button key={p.id} type="button" onMouseDown={() => { setSelProduct(p); setSearch(p.name); setSelSku(null); setOpen(false) }}
                  className="w-full text-left px-3 py-2 hover:bg-slate-50 text-sm border-b border-slate-50 last:border-0">
                  {p.name}
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <label className="label mb-1 text-xs">Varian / SKU</label>
          <select value={selSku?.id ?? ''} onChange={e => setSelSku((skus ?? []).find(s => s.id == e.target.value) ?? null)}
            className="input text-sm bg-white" disabled={!selProduct}>
            <option value="">— pilih varian —</option>
            {(skus ?? []).map(s => (
              <option key={s.id} value={s.id}>{skuVariantLabel(s) || s.sku_code}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 items-end">
        <div>
          <label className="label mb-1 text-xs">Qty</label>
          <input type="number" min={1} value={qty} onChange={e => setQty(e.target.value)}
            className="input text-sm bg-white w-full" />
        </div>
        <div className="col-span-2">
          <label className="label mb-1 text-xs">Catatan item (opsional)</label>
          <input value={note} onChange={e => setNote(e.target.value)} placeholder="warna, ukuran khusus, dll"
            className="input text-sm bg-white w-full" />
        </div>
      </div>

      <button type="button" onClick={handleAdd}
        className="btn-secondary text-xs flex items-center gap-1.5 w-full justify-center">
        <Plus size={12} /> Tambah Item
      </button>
    </div>
  )
}

export default function PengajuanBaru() {
  const navigate   = useNavigate()
  const { user }   = useAuth()

  const [requestTypeId,    setRequestTypeId]    = useState('')
  const [divisi,           setDivisi]           = useState(user?.divisi ?? '')
  const [recipientName,    setRecipientName]    = useState('')
  const [recipientPhone,   setRecipientPhone]   = useState('')
  const [recipientAddress, setRecipientAddress] = useState('')
  const [neededAt,         setNeededAt]         = useState('')
  const [needsReturn,      setNeedsReturn]      = useState(false)
  const [note,             setNote]             = useState('')
  const [items,            setItems]            = useState([])

  const { data: types } = useQuery({ queryKey: ['request-types'], queryFn: requestTypeApi.list })

  const createMutation = useMutation({
    mutationFn: (data) => requestApi.create(data),
    onSuccess: (data) => {
      toast.success('Pengajuan berhasil dibuat!')
      navigate(`/pengajuan/${data.id}`)
    },
    onError: (err) => toast.error(err.response?.data?.message ?? 'Gagal membuat pengajuan'),
  })

  const removeItem = (i) => setItems(prev => prev.filter((_, idx) => idx !== i))

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!requestTypeId) return toast.error('Pilih jenis pengajuan')
    if (items.length === 0) return toast.error('Tambahkan minimal 1 produk')
    createMutation.mutate({ requestTypeId: Number(requestTypeId), divisi, recipientName, recipientPhone, recipientAddress, neededAt: neededAt || null, needsReturn, note, items })
  }

  return (
    <div className="px-6 py-6 max-w-2xl">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-4">
        <ArrowLeft size={14} /> Kembali
      </button>
      <h1 className="text-lg font-bold text-slate-800 mb-5">Buat Pengajuan Baru</h1>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="card p-4 space-y-4">
          <h2 className="text-sm font-semibold text-slate-600 border-b border-slate-100 pb-2">Informasi Pengajuan</h2>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label mb-1">Jenis Pengajuan <span className="text-red-400">*</span></label>
              <select value={requestTypeId} onChange={e => {
                const id = e.target.value
                setRequestTypeId(id)
                const chosen = (types ?? []).find(t => String(t.id) === id)
                if (chosen) {
                  const name = chosen.name.toLowerCase()
                  if (name.includes('photoshoot')) setNeedsReturn(true)
                  else if (name.includes('endorse')) setNeedsReturn(false)
                }
              }} className="input w-full" required>
                <option value="">— pilih jenis —</option>
                {(types ?? []).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label mb-1">Divisi / Departemen</label>
              <input value={divisi} onChange={e => setDivisi(e.target.value)} placeholder="Marketing, Creative, dll"
                className="input w-full" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label mb-1">Nama Penerima</label>
              <input value={recipientName} onChange={e => setRecipientName(e.target.value)} placeholder="Nama influencer / talent"
                className="input w-full" />
            </div>
            <div>
              <label className="label mb-1">No. HP Penerima</label>
              <input value={recipientPhone} onChange={e => setRecipientPhone(e.target.value)} placeholder="08xxxxxxxxxx"
                className="input w-full" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label mb-1">Tanggal Butuh</label>
              <input type="date" value={neededAt} onChange={e => setNeededAt(e.target.value)} className="input w-full" />
            </div>
          </div>

          <div>
            <label className="label mb-1">Alamat Pengiriman</label>
            <textarea value={recipientAddress} onChange={e => setRecipientAddress(e.target.value)}
              placeholder="Alamat lengkap…" rows={2} className="input w-full resize-none" />
          </div>

          <div>
            <label className="label mb-1">Catatan</label>
            <textarea value={note} onChange={e => setNote(e.target.value)}
              placeholder="Informasi tambahan…" rows={2} className="input w-full resize-none" />
          </div>

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" checked={needsReturn} onChange={e => setNeedsReturn(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
            <span className="text-sm text-slate-600">Produk perlu dikembalikan</span>
          </label>
        </div>

        <div className="card p-4 space-y-3">
          <h2 className="text-sm font-semibold text-slate-600 border-b border-slate-100 pb-2">Daftar Produk</h2>

          {items.length > 0 && (
            <div className="space-y-1.5 mb-2">
              {items.map((item, i) => (
                <div key={i} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2">
                  <div>
                    <span className="text-sm font-medium text-slate-700">{item.productName}</span>
                    {item.variantLabel && <span className="text-xs text-slate-400 ml-1.5">— {item.variantLabel}</span>}
                    <span className="text-xs text-indigo-600 ml-2 font-medium">×{item.qty}</span>
                    {item.note && <div className="text-xs text-slate-400 mt-0.5">{item.note}</div>}
                  </div>
                  <button type="button" onClick={() => removeItem(i)} className="text-red-400 hover:text-red-600 p-1">
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <SkuPicker onAdd={(item) => setItems(prev => [...prev, item])} />
        </div>

        <div className="flex gap-2 justify-end">
          <button type="button" onClick={() => navigate(-1)} className="btn-secondary">Batal</button>
          <button type="submit" disabled={createMutation.isPending} className="btn-primary">
            {createMutation.isPending ? 'Menyimpan…' : 'Kirim Pengajuan'}
          </button>
        </div>
      </form>
    </div>
  )
}
