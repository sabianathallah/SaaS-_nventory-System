import { useState, useMemo, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { vendorDeliveriesApi, vendorsApi, productsApi, productSkusApi } from '../api'
import { useAuth } from '../context/AuthContext'
import SearchableSelect from '../components/SearchableSelect'
import ImageLightbox from '../components/ImageLightbox'
import toast from 'react-hot-toast'
import {
  ArrowLeft, Save, Plus, Trash2, Video,
  AlertTriangle, AlertCircle, Check, Upload, X, Printer, ChevronDown, TriangleAlert, History,
  PackagePlus, Undo2,
} from 'lucide-react'
import logoPreface from '../assets/logo-preface.jpeg'

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
const fmtDateTime = (d) => d ? new Date(d).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'

// Badge khusus untuk aksi selisih — beda dari edit biasa
const ACTIVITY_BADGE = {
  SELISIH_CLEAR:  { label: 'Selisih Selesai',  className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  SELISIH_REOPEN: { label: 'Selisih Dibuka',   className: 'bg-orange-50 text-orange-700 border-orange-200' },
  REMOVE_ITEM:    { label: 'Hapus',            className: 'bg-red-50 text-red-600 border-red-200' },
  STATUS_CHANGE:  { label: 'Status',           className: 'bg-indigo-50 text-indigo-600 border-indigo-200' },
  CREATE:         { label: 'Dibuat',           className: 'bg-slate-100 text-slate-600 border-slate-200' },
}

const skuLabel = (sku) => {
  if (!sku) return null
  const opts = sku.ProductVariantOptions ?? []
  return opts.length ? opts.map(o => o.value).join(' / ') : sku.sku_code
}

// ── Item row (inline edit) ────────────────────────────────────────────────────

function ItemRow({ item, deliveryId, canManage, onDeleted, onUpdated }) {
  const [editing,     setEditing]     = useState(false)
  const [qtySJ,       setQtySJ]       = useState(item.qtySJ)
  const [qtyActual,   setQtyActual]   = useState(item.qtyActual)
  const [notes,       setNotes]       = useState(item.notes ?? '')
  const [confirmDel,  setConfirmDel]  = useState(false)

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

  const selisih    = item.qtySJ - item.qtyActual
  const hasSelisih = selisih !== 0
  const rowBg      = hasSelisih ? 'bg-red-50/40' : ''

  if (editing) {
    const liveSelisih = Number(qtySJ) - Number(qtyActual)
    return (
      <tr className="border-b border-slate-100 bg-blue-50/30">
        <td className="td">
          <p className="font-semibold text-slate-800 text-sm">{item.Product?.name ?? '—'}</p>
          {item.Product?.unit && <p className="text-[11px] text-slate-400">{item.Product.unit}</p>}
        </td>
        <td className="td">
          {skuLabel(item.ProductSKU)
            ? <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono">{skuLabel(item.ProductSKU)}</span>
            : <span className="text-xs text-slate-300">—</span>}
        </td>
        <td className="td w-28">
          <input type="number" min={0} className="input text-sm w-20"
            value={qtySJ} onChange={e => setQtySJ(e.target.value)} onFocus={e => e.target.select()} />
        </td>
        <td className="td w-28">
          <input type="number" min={0} className="input text-sm w-20"
            value={qtyActual} onChange={e => setQtyActual(e.target.value)} onFocus={e => e.target.select()} />
        </td>
        <td className="td w-28 text-center">
          <span className={`font-mono font-bold text-sm ${liveSelisih !== 0 ? 'text-danger' : 'text-success'}`}>
            {liveSelisih > 0 ? `-${liveSelisih}` : liveSelisih < 0 ? `+${Math.abs(liveSelisih)}` : '0'}
          </span>
        </td>
        <td className="td">
          <input className="input text-xs" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Catatan…" />
        </td>
        <td className="td w-24">
          <div className="flex gap-1">
            <button
              onClick={() => update.mutate({ qtySJ: Number(qtySJ), qtyActual: Number(qtyActual), notes: notes || null })}
              disabled={update.isPending}
              className="flex items-center gap-1 px-2 py-1 text-xs font-medium bg-success text-white rounded-lg hover:bg-success/90 disabled:opacity-50"
            >
              <Check size={11} /> Simpan
            </button>
            <button onClick={() => { setEditing(false); setQtySJ(item.qtySJ); setQtyActual(item.qtyActual); setNotes(item.notes ?? '') }}
              className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg text-sm">
              <X size={13} />
            </button>
          </div>
        </td>
      </tr>
    )
  }

  return (
    <tr className={`border-b border-slate-100 group hover:bg-slate-50/60 transition-colors ${rowBg}`}>
      <td className="td">
        <p className="font-semibold text-slate-800 text-sm">{item.Product?.name ?? '—'}</p>
        {item.Product?.unit && <p className="text-[11px] text-slate-400">{item.Product.unit}</p>}
      </td>
      <td className="td">
        {skuLabel(item.ProductSKU)
          ? <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono">{skuLabel(item.ProductSKU)}</span>
          : <span className="text-xs text-slate-300">—</span>}
      </td>
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
      <td className="td max-w-[140px]">
        <span className="text-xs text-slate-400 truncate block">{item.notes || '—'}</span>
      </td>
      <td className="td w-24">
        {canManage && (
          confirmDel ? (
            <div className="flex items-center gap-1">
              <button
                onClick={() => del.mutate()}
                disabled={del.isPending}
                className="flex items-center gap-0.5 px-2 py-1 text-xs font-medium bg-red-500 text-white rounded-lg hover:bg-red-600"
              >
                <Trash2 size={10} /> Hapus
              </button>
              <button onClick={() => setConfirmDel(false)} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg">
                <X size={12} />
              </button>
            </div>
          ) : (
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => setEditing(true)}
                className="px-2 py-1 text-xs font-medium text-slate-500 hover:text-brand hover:bg-slate-100 rounded-lg"
              >
                Edit
              </button>
              <button
                onClick={() => setConfirmDel(true)}
                className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg"
              >
                <Trash2 size={12} />
              </button>
            </div>
          )
        )}
      </td>
    </tr>
  )
}

// ── Add Item Form ─────────────────────────────────────────────────────────────

function AddItemForm({ deliveryId, onAdded }) {
  const [productId,    setProductId]    = useState('')
  const [productSkuId, setProductSkuId] = useState('')
  const [qtySJ,        setQtySJ]        = useState(1)
  const [qtyActual,    setQtyActual]    = useState(1)
  const [notes,        setNotes]        = useState('')
  const [showNotes,    setShowNotes]    = useState(false)

  const { data: products } = useQuery({
    queryKey: ['products', { limit: 500 }],
    queryFn:  () => productsApi.list({ limit: 500 }),
  })
  const { data: skus } = useQuery({
    queryKey: ['product-skus', productId],
    queryFn:  () => productSkusApi.list(productId),
    enabled:  !!productId,
  })

  const skuOptions = useMemo(() => {
    if (!skus) return []
    return skus.map(s => ({ value: String(s.id), label: skuLabel(s) || s.sku_code }))
  }, [skus])

  const hasVariants = skuOptions.length > 0

  const add = useMutation({
    mutationFn: (d) => vendorDeliveriesApi.addItem(deliveryId, d),
    onSuccess: (res) => {
      onAdded(res.data)
      setProductId(''); setProductSkuId(''); setQtySJ(1); setQtyActual(1); setNotes(''); setShowNotes(false)
      toast.success('Item ditambahkan')
    },
    onError: e => toast.error(e.response?.data?.message || 'Error'),
  })

  function handleSubmit(e) {
    e.preventDefault()
    if (!productId) return toast.error('Pilih produk terlebih dahulu')
    if (hasVariants && !productSkuId) return toast.error('Pilih varian / size produk terlebih dahulu')
    if (Number(qtySJ) <= 0) return toast.error('Qty SJ harus lebih dari 0')
    add.mutate({
      productId,
      productSkuId: productSkuId || null,
      qtySJ:   Number(qtySJ),
      qtyActual: Number(qtyActual),
      notes: notes.trim() || null,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="p-4 bg-slate-50/60 border-b border-slate-100">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-bold text-slate-600 uppercase tracking-wide">Tambah Item Baru</p>
        <button
          type="button"
          onClick={() => setShowNotes(v => !v)}
          className="text-[11px] text-slate-400 hover:text-slate-600 flex items-center gap-1"
        >
          <ChevronDown size={12} className={`transition-transform ${showNotes ? 'rotate-180' : ''}`} />
          {showNotes ? 'Sembunyikan catatan' : 'Tambah catatan'}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end">
        {/* Produk */}
        <div className="sm:col-span-4">
          <label className="label text-[11px]">Produk <span className="text-danger">*</span></label>
          <SearchableSelect
            value={productId}
            onChange={v => { setProductId(v); setProductSkuId('') }}
            options={[{ value: '', label: 'Pilih produk…' }, ...(products?.data ?? []).map(p => ({ value: String(p.id), label: p.name }))]}
            placeholder="Pilih produk…"
          />
        </div>

        {/* Varian */}
        <div className="sm:col-span-3">
          <label className="label text-[11px]">
            Varian / Size {hasVariants && <span className="text-danger">*</span>}
          </label>
          <SearchableSelect
            value={productSkuId}
            onChange={setProductSkuId}
            options={[
              { value: '', label: !productId ? '← Pilih produk dulu' : hasVariants ? 'Pilih varian…' : 'Tidak ada varian' },
              ...skuOptions,
            ]}
            placeholder={hasVariants ? 'Pilih varian…' : 'Tidak ada varian'}
            disabled={!productId || !hasVariants}
          />
        </div>

        {/* Qty SJ */}
        <div className="sm:col-span-2">
          <label className="label text-[11px]">Qty SJ <span className="text-danger">*</span></label>
          <input
            type="number" min={1} className="input text-sm"
            value={qtySJ}
            onChange={e => { setQtySJ(e.target.value); setQtyActual(e.target.value) }}
            onFocus={e => e.target.select()}
          />
        </div>

        {/* Qty Aktual */}
        <div className="sm:col-span-2">
          <label className="label text-[11px]">Qty Aktual <span className="text-danger">*</span></label>
          <input
            type="number" min={0} className="input text-sm"
            value={qtyActual}
            onChange={e => setQtyActual(e.target.value)}
            onFocus={e => e.target.select()}
          />
        </div>

        {/* Submit */}
        <div className="sm:col-span-1">
          <button type="submit" disabled={add.isPending || !productId} className="btn-primary w-full justify-center">
            <Plus size={13} />
          </button>
        </div>
      </div>

      {/* Inline notes */}
      {showNotes && (
        <div className="mt-2">
          <input
            className="input text-sm w-full"
            placeholder="Catatan untuk item ini…"
            value={notes}
            onChange={e => setNotes(e.target.value)}
          />
        </div>
      )}

      {/* Variant warning */}
      {hasVariants && !productSkuId && productId && (
        <p className="text-[11px] text-amber-600 mt-1.5 flex items-center gap-1">
          <AlertTriangle size={11} /> Produk ini memiliki varian — wajib pilih size/varian sebelum tambah
        </p>
      )}
    </form>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function IncomingGoodsDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { hasPermission } = useAuth()
  const canManage  = hasPermission('packing.manage') || hasPermission('packing.incoming')
  const canClose   = hasPermission('packing.manage') || hasPermission('packing.incoming.close')
  const isNew = !id || id === 'new'

  const fileInputRef = useRef(null)
  const dragIdx      = useRef(null)

  const [vendorId,  setVendorId]  = useState('')
  const [date,      setDate]      = useState(new Date().toISOString().slice(0, 10))
  const [sjNumber,  setSjNumber]  = useState('')
  const [videoLink, setVideoLink] = useState('')
  const [notes,     setNotes]     = useState('')
  const [items,     setItems]     = useState([])
  const [photos,    setPhotos]    = useState([])

  const { data: vendors } = useQuery({
    queryKey: ['vendors', { limit: 200 }],
    queryFn:  () => vendorsApi.list({ limit: 200 }),
  })

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
  const [lightboxPhoto, setLightboxPhoto] = useState(null)

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

  const patchStatus = useMutation({
    mutationFn: (status) => vendorDeliveriesApi.patchStatus(id, status),
    onSuccess: (_, status) => {
      qc.setQueryData(['vendor-delivery', id], old => old
        ? { ...old, data: { ...old.data, status } }
        : old
      )
      toast.success(status === 'closed' ? 'Barang masuk ditutup' : status === 'open' ? 'Barang masuk diaktifkan' : 'Status diperbarui')
    },
    onError: e => toast.error(e.response?.data?.message || 'Error'),
  })

  const patchSelisihStatus = useMutation({
    mutationFn: (status) => vendorDeliveriesApi.patchSelisihStatus(id, status),
    onSuccess: (_, status) => {
      qc.setQueryData(['vendor-delivery', id], old => old
        ? { ...old, data: { ...old.data, selisihStatus: status } }
        : old
      )
      toast.success(status === 'clear' ? 'Selisih ditandai selesai' : 'Status dibuka kembali')
    },
    onError: e => toast.error(e.response?.data?.message || 'Error'),
  })

  function handleSaveHeader(e) {
    e.preventDefault()
    if (!vendorId) return toast.error('Vendor wajib dipilih')
    const newFiles      = photos.filter(p => p.type === 'new').map(p => p.file)
    const existingPhotos = photos.filter(p => p.type === 'existing').map(p => p.url)
    const keepPhotos    = !isNew && isLoading ? (existing?.data?.sjPhotos ?? []) : existingPhotos
    const hasFiles      = newFiles.length > 0
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
        sjNumber:  sjNumber.trim()  || null,
        videoLink: videoLink.trim() || null,
        notes:     notes.trim()     || null,
        keepPhotos: JSON.stringify(keepPhotos),
      }
    }
    if (isNew) createDelivery.mutate(payload)
    else if (id && id !== 'undefined') updateDelivery.mutate(payload)
    else navigate('/incoming-goods', { replace: true })
  }

  const delivery     = existing?.data
  const isClosed     = delivery?.status === 'closed'
  const isDraft      = delivery?.status === 'draft'
  const totalQtySJ   = items.reduce((s, i) => s + (i.qtySJ ?? 0), 0)
  const totalActual  = items.reduce((s, i) => s + (i.qtyActual ?? 0), 0)
  const totalSelisih = items.filter(i => (i.qtySJ - i.qtyActual) !== 0).length

  return (
    <>
    {lightboxPhoto && <ImageLightbox src={lightboxPhoto} alt="Foto Surat Jalan" onClose={() => setLightboxPhoto(null)} />}
    <div className="px-6 py-6 max-w-5xl mx-auto space-y-6 no-print">

      {/* ── Page header ─────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-slate-800 truncate">
            {isNew ? 'Catat Barang Masuk' : `Barang Masuk #${id}`}
          </h1>
          {delivery && (
            <p className="text-sm text-slate-400 truncate">
              {delivery.Vendor?.name} — {fmtDate(delivery.date)}
              {delivery.Creator?.name && <> · Dibuat oleh {delivery.Creator.name}</>}
              {delivery.Updater && delivery.Updater.name !== delivery.Creator?.name && (
                <> · Diedit oleh {delivery.Updater.name}</>
              )}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {!isNew && delivery && (
            <button
              onClick={() => {
                const vendor = delivery.Vendor?.name?.replace(/[/\\?%*:|"<>]/g, '-') ?? 'Vendor'
                const tgl    = delivery.date ?? new Date().toISOString().slice(0, 10)
                const prev   = document.title
                document.title = `Tanda Terima Barang_${vendor}_${tgl}`
                window.print()
                setTimeout(() => { document.title = prev }, 1000)
              }}
              className="btn-secondary text-sm flex items-center gap-2"
            >
              <Printer size={14} /> Print
            </button>
          )}
          {!isNew && delivery && canManage && (
            <button
              onClick={() => navigate(`/stock-in/new?vendorId=${delivery.Vendor?.id ?? ''}&sourceDeliveryId=${id}`)}
              className="btn-secondary text-sm flex items-center gap-2"
              title="Buat dokumen Stock In dengan vendor & referensi barang masuk ini sudah ter-tandai"
            >
              <PackagePlus size={14} /> Buat Stock In
            </button>
          )}
          {!isNew && delivery && canManage && (
            <button
              onClick={() => navigate(`/stock-out/new?vendorId=${delivery.Vendor?.id ?? ''}&sourceDeliveryId=${id}&purpose=${encodeURIComponent('Retur Vendor')}`)}
              className="btn-secondary text-sm flex items-center gap-2"
              title="Buat Stock Out (Retur Vendor) dengan vendor & referensi barang masuk ini sudah ter-tandai"
            >
              <Undo2 size={14} /> Retur ke Vendor
            </button>
          )}
          {!isNew && delivery && isDraft && (
            <span className="badge-muted text-xs px-2 py-1">Draft</span>
          )}
          {!isNew && canClose && isDraft && (
            <button
              onClick={() => patchStatus.mutate('open')}
              disabled={patchStatus.isPending}
              className="btn-primary text-sm flex items-center gap-2"
            >
              <Check size={14} /> Aktifkan
            </button>
          )}
          {!isNew && canClose && isClosed && (
            <button
              onClick={() => patchStatus.mutate('open')}
              disabled={patchStatus.isPending}
              className="btn-secondary text-sm flex items-center gap-2"
            >
              Buka Kembali
            </button>
          )}
          {!isNew && canClose && !isClosed && !isDraft && (
            <button
              onClick={() => patchStatus.mutate('closed')}
              disabled={patchStatus.isPending || isNew}
              className="text-sm flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Tutup Barang Masuk
            </button>
          )}
          {!isNew && canManage && (
            <button
              form="header-form"
              type="submit"
              disabled={updateDelivery.isPending || isLoading}
              className="btn-primary text-sm"
            >
              <Save size={14} /> Simpan Perubahan
            </button>
          )}
        </div>
      </div>

      {/* ── Banner SJ belum dilampirkan ─────────────────────── */}
      {!isNew && delivery && !delivery.sjNumber && !(Array.isArray(delivery.sjPhotos) ? delivery.sjPhotos.length > 0 : !!delivery.sjPhotos) && (
        <div className="flex items-start gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
          <AlertCircle size={16} className="flex-shrink-0 mt-0.5 text-amber-500" />
          <div>
            <p className="font-semibold">Surat Jalan Belum Dilampirkan</p>
            <p className="text-xs text-amber-700 mt-0.5">
              Lengkapi no. SJ atau foto surat jalan di bawah, lalu klik <strong>Simpan Perubahan</strong>.
            </p>
          </div>
        </div>
      )}

      {/* ── Banner selisih status ────────────────────────────── */}
      {!isNew && delivery && delivery.selisihStatus === 'unclear' && (
        <div className="flex items-center gap-3 px-4 py-3 bg-orange-50 border border-orange-200 rounded-xl text-sm text-orange-800">
          <TriangleAlert size={16} className="flex-shrink-0 text-orange-500" />
          <div className="flex-1 min-w-0">
            <p className="font-semibold">Ada Selisih — Belum Dikonfirmasi</p>
            <p className="text-xs text-orange-700 mt-0.5">
              {totalSelisih} item memiliki selisih antara qty SJ dan qty aktual. Tandai selesai setelah sudah dikonfirmasi ke vendor atau diselesaikan.
            </p>
          </div>
          {canManage && (
            <button
              onClick={() => patchSelisihStatus.mutate('clear')}
              disabled={patchSelisihStatus.isPending}
              className="flex-shrink-0 flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50"
            >
              <Check size={12} /> Tandai Selesai
            </button>
          )}
        </div>
      )}
      {!isNew && delivery && delivery.selisihStatus === 'clear' && (
        <div className="flex items-center gap-3 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-800">
          <Check size={16} className="flex-shrink-0 text-emerald-500" />
          <div className="flex-1 min-w-0">
            <p className="font-semibold">Selisih Sudah Dikonfirmasi</p>
            <p className="text-xs text-emerald-700 mt-0.5">Selisih sudah ditangani oleh tim produksi.</p>
          </div>
          {canManage && (
            <button
              onClick={() => patchSelisihStatus.mutate('unclear')}
              disabled={patchSelisihStatus.isPending}
              className="flex-shrink-0 text-xs font-medium px-3 py-1.5 text-emerald-700 bg-emerald-100 hover:bg-emerald-200 rounded-lg transition-colors disabled:opacity-50"
            >
              Buka Kembali
            </button>
          )}
        </div>
      )}

      {/* ── Banner closed ───────────────────────────────────── */}
      {!isNew && isClosed && (
        <div className="flex items-center gap-3 px-4 py-3 bg-slate-100 border border-slate-300 rounded-xl text-sm text-slate-700">
          <svg className="flex-shrink-0 w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <div className="flex-1">
            <p className="font-semibold">Barang Masuk Sudah Ditutup</p>
            <p className="text-xs text-slate-500 mt-0.5">Data item tidak bisa diubah. Vendor, tanggal, dan catatan terkunci. <strong>Surat jalan tetap bisa diedit.</strong></p>
          </div>
        </div>
      )}

      {/* ── Informasi Umum ──────────────────────────────────── */}
      <form id="header-form" onSubmit={handleSaveHeader} className="card p-5 space-y-4">
        <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Informasi Umum</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Vendor <span className="text-danger">*</span></label>
            <SearchableSelect
              value={vendorId}
              onChange={setVendorId}
              options={[{ value: '', label: 'Pilih vendor…' }, ...(vendors?.data ?? []).map(v => ({ value: String(v.id), label: v.name }))]}
              placeholder="Pilih vendor…"
              disabled={!canManage || isClosed}
            />
          </div>
          <div>
            <label className="label">Tanggal Terima <span className="text-danger">*</span></label>
            <input type="date" className="input" value={date} onChange={e => setDate(e.target.value)} disabled={!canManage || isClosed} />
          </div>
          <div>
            <label className="label">
              No. Surat Jalan <span className="text-slate-400 font-normal text-xs">(opsional)</span>
              {isClosed && <span className="ml-2 text-[10px] text-emerald-600 font-medium">· bisa diedit</span>}
            </label>
            <input className="input" type="text" placeholder="Contoh: SJ/2026/001" value={sjNumber} onChange={e => setSjNumber(e.target.value)} disabled={!canManage} />
          </div>
          <div>
            <label className="label">
              Link Video GDrive <span className="text-slate-400 font-normal text-xs">(opsional)</span>
              {isClosed && <span className="ml-2 text-[10px] text-emerald-600 font-medium">· bisa diedit</span>}
            </label>
            <input className="input" type="url" placeholder="https://drive.google.com/…" value={videoLink} onChange={e => setVideoLink(e.target.value)} disabled={!canManage} />
          </div>
        </div>

        {canManage && (
          <div>
            <label className="label">
              Foto Surat Jalan
              <span className="ml-2 text-[10px] font-normal text-slate-400 normal-case tracking-normal">
                {photos.length}/{MAX_PHOTOS} foto · drag untuk urut ulang
              </span>
            </label>
            <div className="flex flex-wrap gap-3 mt-1">
              {photos.map((p, idx) => (
                <div
                  key={idx} draggable
                  onDragStart={() => onDragStart(idx)}
                  onDragOver={e => onDragOver(e, idx)}
                  onDragEnd={onDragEnd}
                  className="relative group cursor-grab active:cursor-grabbing"
                >
                  <img
                    src={p.type === 'existing' ? p.url : p.preview}
                    alt={`SJ ${idx + 1}`}
                    title="Klik untuk buka ukuran penuh"
                    onClick={() => setLightboxPhoto(p.type === 'existing' ? p.url : p.preview)}
                    className="w-24 h-24 object-cover rounded-xl border border-slate-200 select-none cursor-zoom-in"
                  />
                  <button
                    type="button" onClick={() => removePhoto(idx)}
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
                  type="button" onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center justify-center w-24 h-24 border-2 border-dashed border-slate-200 rounded-xl text-slate-400 hover:border-brand hover:text-brand transition-colors gap-1"
                >
                  <Upload size={18} />
                  <span className="text-[10px]">Tambah</span>
                </button>
              )}
              <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoAdd} />
            </div>
          </div>
        )}

        {!canManage && photos.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-slate-600 mb-2">Foto Surat Jalan</p>
            <div className="flex flex-wrap gap-2">
              {photos.map((p, idx) => (
                <img
                  key={idx} src={p.url} alt={`SJ ${idx + 1}`}
                  onClick={() => setLightboxPhoto(p.url)}
                  className="w-16 h-16 object-cover rounded-lg border border-slate-200 hover:opacity-80 transition-opacity cursor-zoom-in"
                />
              ))}
            </div>
          </div>
        )}

        <div>
          <label className="label">Catatan <span className="text-slate-400 font-normal text-xs">(opsional)</span></label>
          <textarea className="input resize-none" rows={2} value={notes} onChange={e => setNotes(e.target.value)} disabled={!canManage || isClosed} placeholder="Catatan opsional…" />
        </div>

        {isNew && canManage && (
          <div className="flex justify-end pt-1">
            <button type="submit" disabled={createDelivery.isPending} className="btn-primary">
              <Save size={14} /> Simpan & Lanjut Input Item
            </button>
          </div>
        )}
      </form>

      {/* ── Daftar Item ─────────────────────────────────────── */}
      {!isNew && (
        <div className="card overflow-hidden">

          {/* Header card */}
          <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-700">
              Daftar Item
              {items.length > 0 && <span className="ml-2 text-xs font-normal text-slate-400">{items.length} item</span>}
            </p>
            {totalSelisih > 0 && (
              <span className="flex items-center gap-1.5 text-xs font-semibold text-danger bg-red-50 px-2.5 py-1 rounded-full border border-red-100">
                <AlertTriangle size={12} /> {totalSelisih} item ada selisih
              </span>
            )}
          </div>

          {/* Tambah Item form — di atas tabel */}
          {canManage && !isClosed && <AddItemForm deliveryId={id} onAdded={(item) => setItems(prev => [...prev, item])} />}

          {/* Tabel items */}
          {isLoading ? (
            <div className="py-10 text-center text-slate-400 text-sm">Memuat…</div>
          ) : items.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-sm space-y-1">
              <p className="font-medium">Belum ada item</p>
              <p className="text-xs">Tambahkan produk menggunakan form di atas</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px]">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/30">
                      <th className="th">Produk</th>
                      <th className="th">Size / Varian</th>
                      <th className="th w-28 text-right">Qty SJ</th>
                      <th className="th w-28 text-right">Qty Aktual</th>
                      <th className="th w-28 text-center">Selisih</th>
                      <th className="th">Catatan</th>
                      <th className="th w-24" />
                    </tr>
                  </thead>
                  <tbody>
                    {items.map(item => (
                      <ItemRow
                        key={item.id}
                        item={item}
                        deliveryId={id}
                        canManage={canManage && !isClosed}
                        onDeleted={(itemId) => setItems(prev => prev.filter(i => i.id !== itemId))}
                        onUpdated={(updated) => setItems(prev => prev.map(i => i.id === updated.id ? updated : i))}
                      />
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Summary row */}
              <div className="px-4 py-3 bg-slate-50/70 border-t border-slate-100 flex items-center gap-6 text-xs">
                <span className="text-slate-500">Total <strong className="text-slate-700">{items.length}</strong> item</span>
                <span className="text-slate-500">Total Qty SJ: <strong className="text-slate-700 font-mono">{totalQtySJ.toLocaleString('id-ID')}</strong></span>
                <span className="text-slate-500">Total Qty Aktual: <strong className="text-slate-700 font-mono">{totalActual.toLocaleString('id-ID')}</strong></span>
                {totalSelisih > 0
                  ? <span className="text-danger font-semibold flex items-center gap-1"><AlertTriangle size={11} /> {totalSelisih} item selisih</span>
                  : <span className="text-success font-semibold flex items-center gap-1"><Check size={11} /> Semua sesuai</span>
                }
              </div>
            </>
          )}
        </div>
      )}

      {!isNew && delivery?.videoLink && (
        <a href={delivery.videoLink} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-sm text-brand hover:underline font-medium">
          <Video size={15} /> Buka Video Pengecekan
        </a>
      )}

      {/* ── Riwayat Aktivitas ────────────────────────────────── */}
      {!isNew && delivery?.logs?.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
            <History size={14} className="text-slate-400" />
            <p className="text-sm font-semibold text-slate-700">Riwayat Aktivitas</p>
            <span className="text-xs font-normal text-slate-400">{delivery.logs.length} aktivitas</span>
          </div>
          <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
            {delivery.logs.map(log => {
              const badge = ACTIVITY_BADGE[log.action]
              return (
                <div key={log.id} className="px-4 py-2.5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm text-slate-700 truncate">
                      <span className="font-semibold">{log.User?.name ?? 'Sistem'}</span>
                      {' — '}
                      <span className="text-slate-500">{log.description}</span>
                    </p>
                    <p className="text-[11px] text-slate-400">{fmtDateTime(log.createdAt)}</p>
                  </div>
                  {badge && (
                    <span className={`flex-shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${badge.className}`}>
                      {badge.label}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
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

  const ROWS_PER_PAGE = 20
  const pages = []
  for (let i = 0; i < Math.max(1, items.length); i += ROWS_PER_PAGE) {
    pages.push(items.slice(i, i + ROWS_PER_PAGE))
  }

  return (
    <>
      {pages.map((pageItems, pageIdx) => (
        <div key={pageIdx} className="print-page">
          {/* Header — sama persis dengan Handover: hanya logo */}
          <div className="print-header">
            <img src={logoPreface} alt="Preface" className="print-logo" />
          </div>
          <div className="print-divider" />

          <div className="print-title">SURAT TANDA TERIMA BARANG</div>

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

          <div className="print-page-info">Halaman {pageIdx + 1} dari {pages.length}</div>

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
              {pageItems.map((item, idx) => {
                const opts    = item.ProductSKU?.ProductVariantOptions ?? []
                const skuStr  = opts.length ? opts.map(o => o.value).join(' / ') : (item.ProductSKU?.sku_code ?? '—')
                const selisih = (item.qtySJ ?? 0) - (item.qtyActual ?? 0)
                const rowNum  = pageIdx * ROWS_PER_PAGE + idx + 1
                return (
                  <tr key={item.id} className={idx % 2 === 0 ? 'print-row-even' : ''}>
                    <td className="print-td print-td-center">{rowNum}</td>
                    <td className="print-td">
                      <strong>{item.Product?.name ?? '—'}</strong>
                      {item.Product?.unit && <span style={{ color: '#64748b', fontSize: '8pt', marginLeft: 4 }}>({item.Product.unit})</span>}
                    </td>
                    <td className="print-td print-td-center" style={{ fontFamily: 'monospace', fontSize: '8pt' }}>{skuStr}</td>
                    <td className="print-td print-td-center">{item.qtySJ ?? 0}</td>
                    <td className="print-td print-td-center">{item.qtyActual ?? 0}</td>
                    <td className="print-td print-td-center" style={{
                      color: selisih > 0 ? '#dc2626' : selisih < 0 ? '#16a34a' : '#1e293b',
                      fontWeight: selisih !== 0 ? 700 : 400,
                    }}>
                      {selisih > 0 ? `-${selisih}` : selisih < 0 ? `+${Math.abs(selisih)}` : '0'}
                    </td>
                    <td className="print-td" style={{ fontSize: '8pt', color: '#64748b' }}>{item.notes ?? '—'}</td>
                  </tr>
                )
              })}
              {pageItems.length === 0 && (
                <tr><td colSpan={7} className="print-td print-td-center" style={{ color: '#94a3b8' }}>Tidak ada item</td></tr>
              )}
            </tbody>
          </table>

          {/* Summary hanya di halaman terakhir */}
          {pageIdx === pages.length - 1 && (
            <div style={{ fontSize: '9pt', color: '#475569', marginBottom: 24, display: 'flex', gap: 32 }}>
              <span>Total item: <strong>{items.length}</strong></span>
              <span>Total qty SJ: <strong>{items.reduce((s, i) => s + (i.qtySJ ?? 0), 0)}</strong></span>
              <span>Total qty aktual: <strong>{items.reduce((s, i) => s + (i.qtyActual ?? 0), 0)}</strong></span>
              <span style={{ color: items.some(i => (i.qtySJ - i.qtyActual) !== 0) ? '#dc2626' : '#16a34a' }}>
                Item selisih: <strong>{items.filter(i => (i.qtySJ - i.qtyActual) !== 0).length}</strong>
              </span>
            </div>
          )}

          <div className="print-footer">
            <div className="print-sign-block">
              <div className="print-sign-title">Diterima oleh,</div>
              <div className="print-sign-space" />
              <div className="print-sign-line" />
              <div className="print-sign-name">{delivery.Creator?.name ?? '_______________'}</div>
              <div className="print-sign-role">Preface Wearhouse</div>
            </div>
            <div className="print-sign-block">
              <div className="print-sign-title">Diserahkan oleh,</div>
              <div className="print-sign-space" />
              <div className="print-sign-line" />
              <div className="print-sign-name">{delivery.Vendor?.name ?? '_______________'}</div>
              <div className="print-sign-role">Perwakilan Vendor</div>
            </div>
          </div>
        </div>
      ))}
    </>
  )
}
