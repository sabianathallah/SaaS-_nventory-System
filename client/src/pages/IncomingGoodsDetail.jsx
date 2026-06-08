import { useState, useMemo, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { vendorDeliveriesApi, deliveryNotesApi, vendorsApi, productsApi, productSkusApi } from '../api'
import { useAuth } from '../context/AuthContext'
import SearchableSelect from '../components/SearchableSelect'
import toast from 'react-hot-toast'
import {
  ArrowLeft, Save, Plus, Trash2, Link2, Video,
  ImageIcon, AlertTriangle, Check,
} from 'lucide-react'

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

  const qc = useQueryClient()
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

  // Header form state
  const [vendorId,        setVendorId]        = useState('')
  const [date,            setDate]            = useState(new Date().toISOString().slice(0, 10))
  const [deliveryNoteId,  setDeliveryNoteId]  = useState('')
  const [videoLink,       setVideoLink]       = useState('')
  const [notes,           setNotes]           = useState('')
  const [items,           setItems]           = useState([])

  const { data: vendors } = useQuery({ queryKey: ['vendors', { limit: 200 }], queryFn: () => vendorsApi.list({ limit: 200 }) })
  const { data: sjList  } = useQuery({ queryKey: ['delivery-notes', { limit: 200 }], queryFn: () => deliveryNotesApi.list({ limit: 200 }) })

  const { data: existing, isLoading } = useQuery({
    queryKey: ['vendor-delivery', id],
    queryFn:  () => vendorDeliveriesApi.get(id),
    enabled:  !isNew,
  })

  useEffect(() => {
    if (!existing?.data) return
    const d = existing.data
    setVendorId(String(d.vendorId))
    setDate(d.date)
    setDeliveryNoteId(d.deliveryNoteId ? String(d.deliveryNoteId) : '')
    setVideoLink(d.videoLink ?? '')
    setNotes(d.notes ?? '')
    setItems(d.items ?? [])
  }, [existing])

  const createDelivery = useMutation({
    mutationFn: (d) => vendorDeliveriesApi.create(d),
    onSuccess: (res) => {
      toast.success('Barang masuk disimpan')
      navigate(`/incoming-goods/${res.data.id}`, { replace: true })
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
    const payload = {
      vendorId,
      date,
      deliveryNoteId: deliveryNoteId || null,
      videoLink:      videoLink.trim() || null,
      notes:          notes.trim() || null,
    }
    if (isNew) createDelivery.mutate(payload)
    else updateDelivery.mutate(payload)
  }

  const delivery = existing?.data

  const sjOptions = (sjList?.data ?? []).map(s => ({
    value: String(s.id),
    label: `SJ #${s.id} — ${fmtDate(s.date)}${s.Vendor ? ` (${s.Vendor.name})` : ''}`,
  }))

  const totalSelisih = items.filter(i => i.selisih !== 0).length

  return (
    <div className="px-6 py-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/incoming-goods')} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-xl font-bold text-slate-800">{isNew ? 'Catat Barang Masuk' : `Barang Masuk #${id}`}</h1>
          {delivery && <p className="text-sm text-slate-400">{delivery.Vendor?.name} — {fmtDate(delivery.date)}</p>}
        </div>
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
            <label className="label">Surat Jalan (opsional)</label>
            <SearchableSelect
              value={deliveryNoteId}
              onChange={setDeliveryNoteId}
              options={[{ value: '', label: 'Pilih SJ…' }, ...sjOptions]}
              placeholder="Pilih SJ…"
              disabled={!canManage}
            />
          </div>
          <div>
            <label className="label">Link Video (GDrive)</label>
            <input className="input" type="url" placeholder="https://drive.google.com/…" value={videoLink} onChange={e => setVideoLink(e.target.value)} disabled={!canManage} />
          </div>
        </div>
        <div>
          <label className="label">Catatan</label>
          <textarea className="input resize-none" rows={2} value={notes} onChange={e => setNotes(e.target.value)} disabled={!canManage} placeholder="Catatan opsional…" />
        </div>

        {/* SJ photo preview */}
        {deliveryNoteId && (() => {
          const sj = sjList?.data?.find(s => String(s.id) === deliveryNoteId)
          return sj?.photoUrl ? (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
              <img src={sj.photoUrl} alt="SJ" className="w-16 h-16 object-cover rounded-lg border border-slate-200" />
              <div>
                <p className="text-xs font-semibold text-slate-600">Foto Surat Jalan #{sj.id}</p>
                <p className="text-[11px] text-slate-400">{fmtDate(sj.date)}</p>
              </div>
            </div>
          ) : null
        })()}

        {canManage && (
          <div className="flex justify-end">
            <button type="submit" disabled={createDelivery.isPending || updateDelivery.isPending} className="btn-primary">
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
  )
}
