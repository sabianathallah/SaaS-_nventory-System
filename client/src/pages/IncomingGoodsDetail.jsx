import { useState, useMemo, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { vendorDeliveriesApi, vendorsApi, productsApi, productSkusApi } from '../api'
import { useAuth } from '../context/AuthContext'
import SearchableSelect from '../components/SearchableSelect'
import toast from 'react-hot-toast'
import {
  ArrowLeft, Save, Plus, Trash2, Video,
  AlertTriangle, Check, Upload, X, Printer,
} from 'lucide-react'
import logoPreface from '../assets/logo-preface.jpeg'

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

const skuLabel = (sku) => {
  if (!sku) return null
  const opts = sku.ProductVariantOptions ?? []
  return opts.length ? opts.map(o => o.value).join(' / ') : sku.sku_code
}

// ── Item row (inline edit) ────────────────────────────────────────────────────

function ItemRow({ item, deliveryId, canManage, onDeleted, onUpdated }) {
  const [editing,   setEditing]   = useState(false)
  const [qtySJ,     setQtySJ]     = useState(item.qtySJ)
  const [qtyActual, setQtyActual] = useState(item.qtyActual)
  const [notes,     setNotes]     = useState(item.notes ?? '')

  const update = useMutation({
    mutationFn: (d) => vendorDeliveriesApi.updateItem(deliveryId, item.id, d),
    onSuccess: (res) => { onUpdated(res.data); setEditing(false) },
    onError: e => toast.error(e.response?.data?.message || 'Error'),
  })
  const del = useMutation({
    mutationFn: () => vendorDeliveriesApi.removeItem(deliveryId, item.id),
    onSuccess: () => { onDeleted(item.id); toast.success('Item dihapus') },
    onError: e => toast.error(e.response?.data?.message || 'Gagal hapus'),
  })

  const selisih = item.qtySJ - item.qtyActual

  return (
    <tr className="border-b border-slate-100 hover:bg-slate-50/50">
      <td className="td">
        <p className="font-semibold text-slate-800 text-sm">{item.Product?.name ?? '—'}</p>
        {item.Product?.unit && <p className="text-[11px] text-slate-400">{item.Product.unit}</p>}
      </td>
      <td className="td">
        {skuLabel(item.ProductSKU)
          ? <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono">{skuLabel(item.ProductSKU)}</span>
          : <span className="text-xs text-slate-300">—</span>}
      </td>

      {editing ? (
        <>
          <td className="td w-28">
            <input type="number" min={0} className="input text-sm w-20" value={qtySJ} onChange={e => setQtySJ(Number(e.target.value))} />
          </td>
          <td className="td w-28">
            <input type="number" min={0} className="input text-sm w-20" value={qtyActual} onChange={e => setQtyActual(Number(e.target.value))} />
          </td>
          <td className="td w-28 text-center">
            <span className={`font-mono font-bold text-sm ${qtySJ - qtyActual !== 0 ? 'text-danger' : 'text-success'}`}>
              {qtySJ - qtyActual > 0 ? `-${qtySJ - qtyActual}` : qtySJ - qtyActual < 0 ? `+${Math.abs(qtySJ - qtyActual)}` : '0'}
            </span>
          </td>
          <td className="td">
            <input className="input text-xs" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Catatan…" />
          </td>
          <td className="td w-20">
            <div className="flex gap-1">
              <button onClick={() => update.mutate({ qtySJ, qtyActual, notes: notes || null })} disabled={update.isPending}
                className="p-1.5 text-success hover:bg-success/10 rounded-lg">
                <Check size={13} />
              </button>
              <button onClick={() => setEditing(false)} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg">×</button>
            </div>
          </td>
        </>
      ) : (
        <>
          <td className="td w-28 text-right">
            <span className="font-mono text-sm text-slate-700">{item.qtySJ.toLocaleString('id-ID')}</span>
          </td>
          <td className="td w-28 text-right">
            <span className="font-mono text-sm text-slate-700">{item.qtyActual.toLocaleString('id-ID')}</span>
          </td>
          <td className="td w-28 text-center">
            {selisih === 0
              ? <span className="text-xs font-semibold text-success bg-success-light px-2 py-0.5 rounded-full">Sesuai</span>
              : <span className={`font-mono font-bold text-sm ${selisih > 0 ? 'text-danger' : 'text-warning'}`}>
                  {selisih > 0 ? `-${selisih}` : `+${Math.abs(selisih)}`}
                </span>}
          </td>
          <td className="td">
            <span className="text-xs text-slate-400 truncate max-w-[140px] block">{item.notes || '—'}</span>
          </td>
          <td className="td w-20">
            {canManage && (
              <div className="flex gap-1 opacity-0 group-hover:opacity-100">
                <button onClick={() => setEditing(true)} className="p-1.5 text-slate-400 hover:text-brand hover:bg-slate-100 rounded-lg text-xs px-2">Edit</button>
                <button onClick={() => { if (confirm('Hapus item ini?')) del.mutate() }}
                  className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg">
                  <Trash2 size={12} />
                </button>
              </div>
            )}
          </td>
        </>
      )}
    </tr>
  )
}

// ── Add Item Form ─────────────────────────────────────────────────────────────

function AddItemForm({ deliveryId, onAdded }) {
  const [productId,    setProductId]    = useState('')
  const [productSkuId, setProductSkuId] = useState('')
  const [qtySJ,        setQtySJ]        = useState(0)
  const [qtyActual,    setQtyActual]    = useState(0)
  const [notes,        setNotes]        = useState('')

  const { data: products } = useQuery({ queryKey: ['products', { limit: 500 }], queryFn: () => productsApi.list({ limit: 500 }) })
  const { data: skus }     = useQuery({ queryKey: ['product-skus', productId], queryFn: () => productSkusApi.list(productId), enabled: !!productId })

  const skuOptions = useMemo(() => {
    if (!skus) return []
    return skus.map(s => ({ value: String(s.id), label: skuLabel(s) || s.sku_code }))
  }, [skus])

  const add = useMutation({
    mutationFn: (d) => vendorDeliveriesApi.addItem(deliveryId, d),
    onSuccess: (res) => {
      onAdded(res.data)
      setProductId(''); setProductSkuId(''); setQtySJ(0); setQtyActual(0); setNotes('')
      toast.success('Item ditambahkan')
    },
    onError: e => toast.error(e.response?.data?.message || 'Error'),
  })

  function handleSubmit(e) {
    e.preventDefault()
    if (!productId) return toast.error('Pilih produk terlebih dahulu')
    add.mutate({ productId, productSkuId: productSkuId || null, qtySJ, qtyActual, notes: notes || null })
  }

  return (
    <form onSubmit={handleSubmit} className="px-4 py-3 bg-slate-50/80 border-t border-slate-100">
      <p className="text-xs font-semibold text-slate-500 mb-3 uppercase tracking-wide">Tambah Item</p>
      <div className="grid grid-cols-1 sm:grid-cols-6 gap-2 items-end">
        <div className="sm:col-span-2">
          <label className="label text-[11px]">Produk *</label>
          <SearchableSelect
            value={productId}
            onChange={v => { setProductId(v); setProductSkuId('') }}
            options={[{ value: '', label: 'Pilih produk…' }, ...(products?.data ?? []).map(p => ({ value: String(p.id), label: p.name }))]}
            placeholder="Pilih produk…"
          />
        </div>
        <div>
          <label className="label text-[11px]">Size / SKU</label>
          <SearchableSelect
            value={productSkuId}
            onChange={setProductSkuId}
            options={[{ value: '', label: 'Semua size' }, ...skuOptions]}
            placeholder="Semua size"
            disabled={!productId}
          />
        </div>
        <div>
          <label className="label text-[11px]">Qty SJ</label>
          <input type="number" min={0} className="input text-sm" value={qtySJ} onChange={e => setQtySJ(Number(e.target.value))} />
        </div>
        <div>
          <label className="label text-[11px]">Qty Aktual</label>
          <input type="number" min={0} className="input text-sm" value={qtyActual} onChange={e => setQtyActual(Number(e.target.value))} />
        </div>
        <div>
          <button type="submit" disabled={add.isPending || !productId} className="btn-primary w-full justify-center">
            <Plus size={13} /> Tambah
          </button>
        </div>
      </div>
    </form>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function IncomingGoodsDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { hasPermission } = useAuth()
  const canManage = hasPermission('packing.manage') || hasPermission('packing.incoming')
  const isNew = id === 'new'

  const fileInputRef = useRef(null)
  const dragIdx      = useRef(null)

  // Header form state
  const [vendorId,  setVendorId]  = useState('')
  const [date,      setDate]      = useState(new Date().toISOString().slice(0, 10))
  const [sjNumber,  setSjNumber]  = useState('')
  const [videoLink, setVideoLink] = useState('')
  const [notes,     setNotes]     = useState('')
  const [items,     setItems]     = useState([])
  // photos: { type:'existing', url:string } | { type:'new', file:File, preview:string }
  const [photos, setPhotos] = useState([])

  const { data: vendors } = useQuery({ queryKey: ['vendors', { limit: 200 }], queryFn: () => vendorsApi.list({ limit: 200 }) })

  const { data: existing, isLoading } = useQuery({
    queryKey: ['vendor-delivery', id],
    queryFn:  () => vendorDeliveriesApi.get(id),
    enabled:  !isNew && !!id,
  })

  useEffect(() => {
    if (!existing?.data) return
    const d = existing.data
    setVendorId(String(d.vendorId))
    setDate(d.date)
    setSjNumber(d.sjNumber ?? '')
    setVideoLink(d.videoLink ?? '')
    setNotes(d.notes ?? '')
    setItems(d.items ?? [])
    setPhotos((d.sjPhotos ?? []).map(url => ({ type: 'existing', url })))
  }, [existing])

  const MAX_PHOTOS = 8

  function handlePhotoAdd(e) {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    const remaining = MAX_PHOTOS - photos.length
    const toAdd = files.slice(0, remaining).map(file => ({
      type: 'new', file, preview: URL.createObjectURL(file),
    }))
    setPhotos(prev => [...prev, ...toAdd])
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function removePhoto(idx) {
    setPhotos(prev => {
      const p = prev[idx]
      if (p.type === 'new') URL.revokeObjectURL(p.preview)
      return prev.filter((_, i) => i !== idx)
    })
  }

  // drag & drop reorder
  function onDragStart(idx) { dragIdx.current = idx }
  function onDragOver(e, idx) {
    e.preventDefault()
    if (dragIdx.current === null || dragIdx.current === idx) return
    setPhotos(prev => {
      const next = [...prev]
      const [moved] = next.splice(dragIdx.current, 1)
      next.splice(idx, 0, moved)
      dragIdx.current = idx
      return next
    })
  }
  function onDragEnd() { dragIdx.current = null }

  const createDelivery = useMutation({
    mutationFn: (d) => vendorDeliveriesApi.create(d),
    onSuccess: (res) => {
      const newId = res?.data?.id
      if (!newId) { toast.error('Gagal mendapatkan ID barang masuk'); return }
      toast.success('Barang masuk disimpan')
      navigate(`/incoming-goods/${newId}`, { replace: true })
    },
    onError: e => toast.error(e.response?.data?.message || 'Error'),
  })

  const updateDelivery = useMutation({
    mutationFn: (d) => vendorDeliveriesApi.update(id, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['vendor-delivery', id] }); toast.success('Disimpan') },
    onError: e => toast.error(e.response?.data?.message || 'Error'),
  })

  function handleSaveHeader(e) {
    e.preventDefault()
    if (!vendorId) return toast.error('Vendor wajib dipilih')
    const newFiles   = photos.filter(p => p.type === 'new').map(p => p.file)
    // Fallback ke data server jika state belum ter-load (race condition guard)
    const existingPhotos = photos.filter(p => p.type === 'existing').map(p => p.url)
    const keepPhotos = !isNew && isLoading ? (existing?.data?.sjPhotos ?? []) : existingPhotos
    const hasFiles   = newFiles.length > 0
    let payload
    if (hasFiles) {
      const fd = new FormData()
      fd.append('vendorId',   vendorId)
      fd.append('date',       date)
      fd.append('sjNumber',   sjNumber.trim() || '')
      fd.append('videoLink',  videoLink.trim() || '')
      fd.append('notes',      notes.trim() || '')
      fd.append('keepPhotos', JSON.stringify(keepPhotos))
      newFiles.forEach(f => fd.append('sjPhotoFiles', f))
      payload = fd
    } else {
      payload = {
        vendorId, date,
        sjNumber:   sjNumber.trim()   || null,
        videoLink:  videoLink.trim()  || null,
        notes:      notes.trim()      || null,
        keepPhotos: JSON.stringify(keepPhotos),
      }
    }
    if (isNew) createDelivery.mutate(payload)
    else updateDelivery.mutate(payload)
  }

  const delivery = existing?.data
  const totalSelisih = items.filter(i => i.selisih !== 0).length

  return (
    <>
    <div className="px-6 py-6 max-w-5xl mx-auto space-y-6 no-print">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/incoming-goods')} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-slate-800">{isNew ? 'Catat Barang Masuk' : `Barang Masuk #${id}`}</h1>
          {delivery && <p className="text-sm text-slate-400">{delivery.Vendor?.name} — {fmtDate(delivery.date)}</p>}
        </div>
        {!isNew && delivery && (
          <button onClick={() => window.print()} className="btn-secondary text-sm flex items-center gap-2">
            <Printer size={14} /> Print
          </button>
        )}
      </div>

      {/* Header form */}
      <form onSubmit={handleSaveHeader} className="card p-5 space-y-4">
        <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Informasi Umum</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Vendor <span className="text-danger">*</span></label>
            <SearchableSelect
              value={vendorId}
              onChange={setVendorId}
              options={[{ value: '', label: 'Pilih vendor…' }, ...(vendors?.data ?? []).map(v => ({ value: String(v.id), label: v.name }))]}
              placeholder="Pilih vendor…"
              disabled={!canManage}
            />
          </div>
          <div>
            <label className="label">Tanggal Terima <span className="text-danger">*</span></label>
            <input type="date" className="input" value={date} onChange={e => setDate(e.target.value)} disabled={!canManage} />
          </div>
          <div>
            <label className="label">No. Surat Jalan (opsional)</label>
            <input className="input" type="text" placeholder="Contoh: SJ/2026/001" value={sjNumber} onChange={e => setSjNumber(e.target.value)} disabled={!canManage} />
          </div>
          <div>
            <label className="label">Link Video (GDrive)</label>
            <input className="input" type="url" placeholder="https://drive.google.com/…" value={videoLink} onChange={e => setVideoLink(e.target.value)} disabled={!canManage} />
          </div>
        </div>

        {/* SJ Photos */}
        {canManage && (
          <div>
            <label className="label">
              Foto Surat Jalan (opsional)
              <span className="ml-2 text-[10px] font-normal text-slate-400 normal-case tracking-normal">
                {photos.length}/{MAX_PHOTOS} foto · drag untuk urut ulang
              </span>
            </label>
            <div className="flex flex-wrap gap-3 mt-1">
              {photos.map((p, idx) => (
                <div
                  key={idx}
                  draggable
                  onDragStart={() => onDragStart(idx)}
                  onDragOver={e => onDragOver(e, idx)}
                  onDragEnd={onDragEnd}
                  className="relative group cursor-grab active:cursor-grabbing"
                >
                  <img
                    src={p.type === 'existing' ? p.url : p.preview}
                    alt={`SJ ${idx + 1}`}
                    className="w-24 h-24 object-cover rounded-xl border border-slate-200 select-none"
                  />
                  <button
                    type="button"
                    onClick={() => removePhoto(idx)}
                    className="absolute -top-1.5 -right-1.5 bg-white border border-slate-200 rounded-full p-0.5 text-slate-400 hover:text-red-500 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X size={12} />
                  </button>
                  <span className="absolute bottom-1 left-1 bg-black/40 text-white text-[9px] px-1 rounded leading-none py-0.5">
                    {idx + 1}
                  </span>
                </div>
              ))}

              {photos.length < MAX_PHOTOS && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center justify-center w-24 h-24 border-2 border-dashed border-slate-200 rounded-xl text-slate-400 hover:border-brand hover:text-brand transition-colors gap-1"
                >
                  <Upload size={18} />
                  <span className="text-[10px]">Tambah</span>
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handlePhotoAdd}
              />
            </div>
          </div>
        )}

        {/* Read-only photo display for non-managers */}
        {!canManage && photos.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-slate-600 mb-2">Foto Surat Jalan</p>
            <div className="flex flex-wrap gap-2">
              {photos.map((p, idx) => (
                <a key={idx} href={p.url} target="_blank" rel="noopener noreferrer">
                  <img src={p.url} alt={`SJ ${idx + 1}`} className="w-16 h-16 object-cover rounded-lg border border-slate-200 hover:opacity-80 transition-opacity" />
                </a>
              ))}
            </div>
          </div>
        )}

        <div>
          <label className="label">Catatan</label>
          <textarea className="input resize-none" rows={2} value={notes} onChange={e => setNotes(e.target.value)} disabled={!canManage} placeholder="Catatan opsional…" />
        </div>

        {canManage && (
          <div className="flex justify-end">
            <button type="submit" disabled={createDelivery.isPending || updateDelivery.isPending || isLoading} className="btn-primary">
              <Save size={14} /> {isNew ? 'Simpan & Lanjut Input Item' : 'Simpan Perubahan'}
            </button>
          </div>
        )}
      </form>

      {/* Items section — only shown after delivery exists */}
      {!isNew && (
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-700">Daftar Item</p>
            {totalSelisih > 0 && (
              <span className="flex items-center gap-1.5 text-xs font-semibold text-danger bg-red-50 px-2.5 py-1 rounded-full border border-red-100">
                <AlertTriangle size={12} /> {totalSelisih} item ada selisih
              </span>
            )}
          </div>

          {isLoading ? (
            <div className="py-10 text-center text-slate-400 text-sm">Memuat…</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px]">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/30">
                    <th className="th">Produk</th>
                    <th className="th">Size</th>
                    <th className="th w-28 text-right">Qty SJ</th>
                    <th className="th w-28 text-right">Qty Aktual</th>
                    <th className="th w-28 text-center">Selisih</th>
                    <th className="th">Catatan</th>
                    <th className="th w-20" />
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-10 text-center text-slate-400 text-sm">
                        Belum ada item. Tambahkan item di bawah.
                      </td>
                    </tr>
                  ) : items.map(item => (
                    <ItemRow
                      key={item.id}
                      item={item}
                      deliveryId={id}
                      canManage={canManage}
                      onDeleted={(itemId) => setItems(prev => prev.filter(i => i.id !== itemId))}
                      onUpdated={(updated) => setItems(prev => prev.map(i => i.id === updated.id ? updated : i))}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {canManage && <AddItemForm deliveryId={id} onAdded={(item) => setItems(prev => [...prev, item])} />}
        </div>
      )}

      {/* Video link shortcut */}
      {!isNew && delivery?.videoLink && (
        <a href={delivery.videoLink} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-sm text-brand hover:underline font-medium">
          <Video size={15} /> Buka Video Pengecekan
        </a>
      )}
    </div>

    {/* Print layout */}
    {!isNew && delivery && (
      <div className="print-only">
        <IncomingGoodsPrintLayout delivery={delivery} items={items} />
      </div>
    )}
    </>
  )
}

// ── Print Layout ──────────────────────────────────────────────────────────────
function IncomingGoodsPrintLayout({ delivery, items }) {
  const fmt = (d) => d ? new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }) : '—'
  const now  = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })

  return (
    <div className="print-page">
      {/* Header */}
      <div className="print-header">
        <img src={logoPreface} alt="Preface" className="print-logo" />
        <div>
          <div className="print-company-name">Preface Wearhouse</div>
          <div className="print-company-sub">Sistem Inventori Internal</div>
        </div>
      </div>
      <div className="print-divider" />
      <div className="print-title">SURAT TANDA TERIMA BARANG</div>

      {/* Meta info */}
      <div className="print-meta">
        <table className="print-meta-table">
          <tbody>
            <tr>
              <td className="print-meta-key">No. Dokumen</td>
              <td className="print-meta-sep">:</td>
              <td className="print-meta-val">STB-{String(delivery.id).padStart(4, '0')}</td>
              <td className="print-meta-key">Tanggal Terima</td>
              <td className="print-meta-sep">:</td>
              <td className="print-meta-val">{fmt(delivery.date)}</td>
            </tr>
            <tr>
              <td className="print-meta-key">Vendor</td>
              <td className="print-meta-sep">:</td>
              <td className="print-meta-val">{delivery.Vendor?.name ?? '—'}</td>
              <td className="print-meta-key">No. Surat Jalan</td>
              <td className="print-meta-sep">:</td>
              <td className="print-meta-val">{delivery.sjNumber ?? '—'}</td>
            </tr>
            <tr>
              <td className="print-meta-key">Dicetak oleh</td>
              <td className="print-meta-sep">:</td>
              <td className="print-meta-val">{delivery.Creator?.name ?? '—'}</td>
              <td className="print-meta-key">Tanggal Cetak</td>
              <td className="print-meta-sep">:</td>
              <td className="print-meta-val">{now}</td>
            </tr>
            {delivery.notes && (
              <tr>
                <td className="print-meta-key">Catatan</td>
                <td className="print-meta-sep">:</td>
                <td className="print-meta-val" colSpan={3}>{delivery.notes}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Items table */}
      <table className="print-table">
        <thead>
          <tr>
            <th className="print-th print-th-no">No</th>
            <th className="print-th">Nama Produk</th>
            <th className="print-th">SKU / Varian</th>
            <th className="print-th" style={{ width: 70, textAlign: 'center' }}>Qty SJ</th>
            <th className="print-th" style={{ width: 80, textAlign: 'center' }}>Qty Aktual</th>
            <th className="print-th" style={{ width: 70, textAlign: 'center' }}>Selisih</th>
            <th className="print-th">Catatan</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, idx) => {
            const opts = item.ProductSKU?.ProductVariantOptions ?? []
            const skuStr = opts.length ? opts.map(o => o.value).join(' / ') : (item.ProductSKU?.sku_code ?? '—')
            const selisih = (item.qtySJ ?? 0) - (item.qtyActual ?? 0)
            return (
              <tr key={item.id} className={idx % 2 === 1 ? 'print-row-even' : ''}>
                <td className="print-td print-td-center">{idx + 1}</td>
                <td className="print-td">
                  <strong>{item.Product?.name ?? '—'}</strong>
                  {item.Product?.unit && <span style={{ color: '#64748b', fontSize: '8pt', marginLeft: 4 }}>({item.Product.unit})</span>}
                </td>
                <td className="print-td print-td-center" style={{ fontFamily: 'monospace', fontSize: '8pt' }}>{skuStr}</td>
                <td className="print-td print-td-center">{item.qtySJ ?? 0}</td>
                <td className="print-td print-td-center">{item.qtyActual ?? 0}</td>
                <td className="print-td print-td-center" style={{ color: selisih !== 0 ? '#dc2626' : '#16a34a', fontWeight: 700 }}>
                  {selisih > 0 ? `+${selisih}` : selisih}
                </td>
                <td className="print-td" style={{ fontSize: '8pt', color: '#64748b' }}>{item.notes ?? '—'}</td>
              </tr>
            )
          })}
          {items.length === 0 && (
            <tr><td colSpan={7} className="print-td print-td-center" style={{ color: '#94a3b8' }}>Tidak ada item</td></tr>
          )}
        </tbody>
      </table>

      {/* Summary */}
      <div style={{ fontSize: '9pt', color: '#475569', marginBottom: 24, display: 'flex', gap: 32 }}>
        <span>Total item: <strong>{items.length}</strong></span>
        <span>Total qty SJ: <strong>{items.reduce((s, i) => s + (i.qtySJ ?? 0), 0)}</strong></span>
        <span>Total qty aktual: <strong>{items.reduce((s, i) => s + (i.qtyActual ?? 0), 0)}</strong></span>
        <span style={{ color: items.some(i => i.selisih !== 0) ? '#dc2626' : '#16a34a' }}>
          Item selisih: <strong>{items.filter(i => i.selisih !== 0).length}</strong>
        </span>
      </div>

      {/* Signature */}
      <div className="print-footer">
        <div className="print-sign-block">
          <div className="print-sign-title">Diterima oleh</div>
          <div className="print-sign-role" style={{ marginBottom: 4 }}>PIC Operasional / Produksi</div>
          <div className="print-sign-space" />
          <div className="print-sign-line" />
          <div className="print-sign-name">{delivery.Creator?.name ?? '_______________'}</div>
          <div className="print-sign-role">Preface Wearhouse</div>
        </div>
        <div className="print-sign-block">
          <div className="print-sign-title">Diserahkan oleh</div>
          <div className="print-sign-role" style={{ marginBottom: 4 }}>Perwakilan Vendor</div>
          <div className="print-sign-space" />
          <div className="print-sign-line" />
          <div className="print-sign-name">{delivery.Vendor?.name ?? '_______________'}</div>
          <div className="print-sign-role">Vendor</div>
        </div>
      </div>
    </div>
  )
}
