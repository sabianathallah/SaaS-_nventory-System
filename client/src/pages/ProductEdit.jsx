import { useState, useRef, useEffect } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  productsApi, categoriesApi, articlesApi,
  productVariantsApi, productSkusApi,
} from '../api'
import CreatableSelect from '../components/CreatableSelect'
import QrModal from '../components/QrModal'
import toast from 'react-hot-toast'
import {
  ArrowLeft, Save, Trash2, Plus, X, ImageIcon, Upload,
  Loader2, RefreshCw, Hash, Layers, ChevronRight, Package,
  AlertCircle, Check, SkipForward, QrCode, Pencil, GripVertical,
} from 'lucide-react'
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core'
import {
  SortableContext, horizontalListSortingStrategy, verticalListSortingStrategy,
  useSortable, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

// ── Helpers ───────────────────────────────────────────────────────────────────

const MAX_IMAGE   = 5 * 1024 * 1024
const EMPTY_FORM  = { name: '', unit: '', CategoryId: '', ArticleId: '', image: null, imageUrl: '' }
const DEFAULT_UNITS = ['pcs', 'unit'].map(u => ({ id: u, name: u }))

function cartesian(types) {
  const active = types.filter(t => t.ProductVariantOptions?.length > 0)
  if (!active.length) return [[]]
  return active.reduce(
    (combos, type) =>
      combos.flatMap(combo =>
        type.ProductVariantOptions.map(opt => [
          ...combo,
          { typeId: type.id, typeName: type.name, optionId: opt.id, value: opt.value },
        ])
      ),
    [[]]
  )
}

// ── Section wrapper ───────────────────────────────────────────────────────────

function Section({ icon: Icon, title, subtitle, children, action }) {
  return (
    <div className="card overflow-visible">
      <div className="flex items-start justify-between px-6 py-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 flex-shrink-0">
            <Icon size={15} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800">{title}</h3>
            {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
          </div>
        </div>
        {action}
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  )
}

// ── Image Uploader ────────────────────────────────────────────────────────────

function ImageUploader({ image, imageUrl, onChange, onClear }) {
  const inputRef = useRef(null)
  const handleFile = (file) => {
    if (!file) return
    if (!file.type.startsWith('image/')) return toast.error('File harus berupa gambar')
    if (file.size > MAX_IMAGE) return toast.error('Ukuran file maks 5MB')
    onChange(file, URL.createObjectURL(file))
  }
  const preview = image ? imageUrl : imageUrl || null
  return (
    <div className="flex flex-col gap-3">
      <div
        className="w-full rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden hover:border-brand/30 transition-colors cursor-pointer"
        style={{ aspectRatio: '4/3' }}
        onClick={() => inputRef.current?.click()}
        onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); handleFile(e.dataTransfer.files?.[0]) }}
      >
        {preview
          ? <img src={preview} alt="preview" className="w-full h-full object-cover" />
          : <div className="text-center p-6"><ImageIcon size={28} className="mx-auto text-slate-300 mb-2" /><p className="text-xs text-slate-400 font-medium">Drop foto di sini</p><p className="text-xs text-slate-300 mt-1">atau klik untuk memilih</p></div>}
      </div>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={e => handleFile(e.target.files?.[0])} />
      <div className="flex gap-2">
        <button type="button" onClick={() => inputRef.current?.click()} className="btn-secondary flex-1 text-xs justify-center">
          <Upload size={12} /> {preview ? 'Ganti Foto' : 'Upload Foto'}
        </button>
        {preview && (
          <button type="button" onClick={onClear} className="btn-secondary text-xs text-red-500 hover:bg-red-50 hover:border-red-200"><X size={12} /></button>
        )}
      </div>
    </div>
  )
}

// ── Variant Builder ───────────────────────────────────────────────────────────

function SortableOptionTag({ opt, typeId, onDelete, isDeleting }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: opt.id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex:  isDragging ? 50 : 'auto',
  }
  return (
    <span
      ref={setNodeRef}
      style={style}
      className="inline-flex items-center gap-1 pl-1.5 pr-1.5 py-1 rounded-full text-xs font-semibold bg-white border border-slate-200 text-slate-700 shadow-sm select-none"
    >
      <span
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-400 px-0.5 touch-none"
      >
        <GripVertical size={10} />
      </span>
      {opt.value}
      <button
        type="button"
        onClick={() => onDelete({ typeId, optionId: opt.id })}
        disabled={isDeleting}
        className="text-slate-300 hover:text-red-400 hover:bg-red-50 rounded-full p-0.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {isDeleting ? <Loader2 size={9} className="animate-spin" /> : <X size={9} />}
      </button>
    </span>
  )
}

function SortableTypeCard({ type, opts, addingOptFor, newOptValue, setAddingOptFor, setNewOptValue, createOption, deleteOption, deleteType, reorderOptions, sensors, deletingId }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: type.id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex:  isDragging ? 10 : 'auto',
  }
  return (
    <div ref={setNodeRef} style={style} className="group flex items-start gap-2 p-4 rounded-xl border border-slate-100 bg-slate-50/60 hover:border-slate-200 transition-colors">
      <span
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-400 mt-0.5 pt-0.5 touch-none flex-shrink-0"
      >
        <GripVertical size={14} />
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-2.5">{type.name}</p>
        <div className="flex flex-wrap gap-1.5">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={e => reorderOptions(type.id, e)}>
            <SortableContext items={opts.map(o => o.id)} strategy={horizontalListSortingStrategy}>
              {opts.map(opt => (
                <SortableOptionTag key={opt.id} opt={opt} typeId={type.id} onDelete={deleteOption.mutate} isDeleting={deletingId === opt.id} />
              ))}
            </SortableContext>
          </DndContext>

          {addingOptFor === type.id ? (
            <form className="inline-flex items-center gap-1.5" onSubmit={e => { e.preventDefault(); if (newOptValue.trim()) createOption.mutate({ typeId: type.id, value: newOptValue.trim() }) }}>
              <input autoFocus value={newOptValue} onChange={e => setNewOptValue(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') { setAddingOptFor(null); setNewOptValue('') } }} onBlur={() => { if (!newOptValue.trim()) setAddingOptFor(null) }} placeholder="Nama opsi…" className="px-2.5 py-1 text-xs rounded-full border border-brand/40 focus:outline-none focus:border-brand/70 bg-white w-28 shadow-sm" />
              <button type="submit" disabled={!newOptValue.trim() || createOption.isPending} className="p-1.5 rounded-full bg-brand text-white disabled:opacity-40">{createOption.isPending ? <Loader2 size={10} className="animate-spin" /> : <Plus size={10} />}</button>
              <button type="button" onClick={() => { setAddingOptFor(null); setNewOptValue('') }} className="p-1.5 rounded-full text-slate-300 hover:text-slate-500 hover:bg-slate-100"><X size={10} /></button>
            </form>
          ) : (
            <button type="button" onClick={() => { setAddingOptFor(type.id); setNewOptValue('') }} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium text-slate-400 border border-dashed border-slate-300 hover:border-brand/50 hover:text-brand bg-transparent transition-colors">
              <Plus size={10} /> tambah opsi
            </button>
          )}
        </div>
      </div>
      <button type="button" onClick={() => { if (confirm(`Hapus tipe "${type.name}" beserta semua opsinya?`)) deleteType.mutate(type.id) }} className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-slate-300 hover:text-red-400 hover:bg-red-50 transition-all flex-shrink-0 mt-0.5"><Trash2 size={13} /></button>
    </div>
  )
}

function VariantBuilder({ productId }) {
  const qc = useQueryClient()
  const [addingType, setAddingType]     = useState(false)
  const [newTypeName, setNewTypeName]   = useState('')
  const [addingOptFor, setAddingOptFor] = useState(null)
  const [newOptValue, setNewOptValue]   = useState('')
  const [localOptions, setLocalOptions] = useState({})
  const [localTypes, setLocalTypes]     = useState([])
  const [deletingId, setDeletingId]     = useState(null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const { data: types = [], isLoading } = useQuery({
    queryKey: ['variant-types', productId],
    queryFn:  () => productVariantsApi.getTypes(productId),
  })

  useEffect(() => {
    const map = {}
    types.forEach(t => { map[t.id] = t.ProductVariantOptions ?? [] })
    setLocalOptions(map)
    setLocalTypes(types)
  }, [types])

  const createType    = useMutation({ mutationFn: name => productVariantsApi.createType(productId, { name }), onSuccess: () => { qc.invalidateQueries({ queryKey: ['variant-types', productId] }); setAddingType(false); setNewTypeName('') }, onError: e => toast.error(e.response?.data?.message || 'Gagal') })
  const deleteType    = useMutation({ mutationFn: tid  => productVariantsApi.deleteType(productId, tid), onSuccess: () => { qc.invalidateQueries({ queryKey: ['variant-types', productId] }); qc.invalidateQueries({ queryKey: ['product-skus', productId] }) }, onError: e => toast.error(e.response?.data?.message || 'Gagal') })
  const createOption  = useMutation({ mutationFn: ({ typeId, value }) => productVariantsApi.createOption(productId, typeId, { value }), onSuccess: () => { qc.invalidateQueries({ queryKey: ['variant-types', productId] }); setAddingOptFor(null); setNewOptValue('') }, onError: e => toast.error(e.response?.data?.message || 'Gagal') })
  const deleteOption  = useMutation({ mutationFn: ({ typeId, optionId }) => { setDeletingId(optionId); return productVariantsApi.deleteOption(productId, typeId, optionId) }, onSuccess: () => { setDeletingId(null); qc.invalidateQueries({ queryKey: ['variant-types', productId] }); qc.invalidateQueries({ queryKey: ['product-skus', productId] }) }, onError: e => { setDeletingId(null); toast.error(e.response?.data?.message || 'Gagal') } })
  const reorderOpts   = useMutation({ mutationFn: ({ typeId, order }) => productVariantsApi.reorderOptions(productId, typeId, order), onError: e => { toast.error('Gagal menyimpan urutan'); qc.invalidateQueries({ queryKey: ['variant-types', productId] }) } })
  const reorderTypes  = useMutation({ mutationFn: order => productVariantsApi.reorderTypes(productId, order), onError: e => { toast.error('Gagal menyimpan urutan'); qc.invalidateQueries({ queryKey: ['variant-types', productId] }) } })

  const handleOptionDragEnd = (typeId, event) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setLocalOptions(prev => {
      const opts      = prev[typeId] ?? []
      const oldIdx    = opts.findIndex(o => o.id === active.id)
      const newIdx    = opts.findIndex(o => o.id === over.id)
      const reordered = arrayMove(opts, oldIdx, newIdx)
      reorderOpts.mutate({ typeId, order: reordered.map(o => o.id) })
      return { ...prev, [typeId]: reordered }
    })
  }

  const handleTypeDragEnd = (event) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setLocalTypes(prev => {
      const oldIdx    = prev.findIndex(t => t.id === active.id)
      const newIdx    = prev.findIndex(t => t.id === over.id)
      const reordered = arrayMove(prev, oldIdx, newIdx)
      reorderTypes.mutate(reordered.map(t => t.id))
      return reordered
    })
  }

  if (isLoading) return <div className="flex items-center gap-2 text-sm text-slate-400 py-2"><Loader2 size={14} className="animate-spin" /> Memuat variant…</div>

  return (
    <div className="space-y-3">
      {!localTypes.length && !addingType && (
        <div className="text-center py-8 rounded-xl border-2 border-dashed border-slate-200">
          <Layers size={28} className="mx-auto text-slate-200 mb-2" />
          <p className="text-sm font-medium text-slate-400">Belum ada tipe variant</p>
          <p className="text-xs text-slate-300 mt-1">Contoh: <span className="font-semibold">Ukuran</span> (S, M, L) · <span className="font-semibold">Warna</span> (Merah, Biru)</p>
        </div>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleTypeDragEnd}>
        <SortableContext items={localTypes.map(t => t.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {localTypes.map(type => (
              <SortableTypeCard
                key={type.id}
                type={type}
                opts={localOptions[type.id] ?? type.ProductVariantOptions ?? []}
                addingOptFor={addingOptFor}
                newOptValue={newOptValue}
                setAddingOptFor={setAddingOptFor}
                setNewOptValue={setNewOptValue}
                createOption={createOption}
                deleteOption={deleteOption}
                deleteType={deleteType}
                reorderOptions={handleOptionDragEnd}
                sensors={sensors}
                deletingId={deletingId}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {addingType ? (
        <form onSubmit={e => { e.preventDefault(); if (newTypeName.trim()) createType.mutate(newTypeName.trim()) }} className="flex items-center gap-2">
          <input autoFocus value={newTypeName} onChange={e => setNewTypeName(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') { setAddingType(false); setNewTypeName('') } }} placeholder="Nama tipe variant, cth: Ukuran" className="input flex-1" />
          <button type="submit" disabled={!newTypeName.trim() || createType.isPending} className="btn-primary">{createType.isPending ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Tambah</button>
          <button type="button" onClick={() => { setAddingType(false); setNewTypeName('') }} className="btn-secondary"><X size={14} /></button>
        </form>
      ) : (
        <button type="button" onClick={() => setAddingType(true)} className="flex items-center gap-2 text-sm font-semibold text-brand hover:text-brand/80 transition-colors pt-1">
          <div className="w-5 h-5 rounded-full border-2 border-brand/30 flex items-center justify-center"><Plus size={11} /></div>
          Tambah Tipe Variant
        </button>
      )}
    </div>
  )
}

// ── QR Modal ──────────────────────────────────────────────────────────────────


// ── SKU Table (editable) ──────────────────────────────────────────────────────

const EMPTY_MANUAL = { sku_code: '', price: '', qty: '', variantOptionIds: [] }

function SkuTable({ productId, productName }) {
  const qc = useQueryClient()
  const [edits, setEdits]           = useState({})
  const [generating, setGenerating] = useState(false)
  const [qrSku, setQrSku]           = useState(null)
  const [showManual, setShowManual] = useState(false)
  const [manual, setManual]         = useState(EMPTY_MANUAL)

  const { data: skus = [], isLoading } = useQuery({ queryKey: ['product-skus', productId], queryFn: () => productSkusApi.list(productId) })
  const { data: types = [] }           = useQuery({ queryKey: ['variant-types', productId], queryFn: () => productVariantsApi.getTypes(productId) })

  const updateSku = useMutation({
    mutationFn: ({ skuId, data }) => productSkusApi.update(productId, skuId, data),
    onSuccess: (_, { skuId }) => { qc.invalidateQueries({ queryKey: ['product-skus', productId] }); setEdits(p => { const n = { ...p }; delete n[skuId]; return n }) },
    onError: e => toast.error(e.response?.data?.message || 'Gagal menyimpan SKU'),
  })
  const deleteSku = useMutation({ mutationFn: sid => productSkusApi.delete(productId, sid), onSuccess: () => qc.invalidateQueries({ queryKey: ['product-skus', productId] }), onError: e => toast.error(e.response?.data?.message || 'Gagal') })
  const createSku = useMutation({
    mutationFn: data => productSkusApi.create(productId, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['product-skus', productId] }); setShowManual(false); setManual(EMPTY_MANUAL); toast.success('SKU ditambahkan') },
    onError: e => toast.error(e.response?.data?.message || 'Gagal menambah SKU'),
  })

  const edit  = (sid, f, v) => setEdits(p => ({ ...p, [sid]: { ...p[sid], [f]: v } }))
  const dirty = (sid)       => !!(edits[sid] && Object.keys(edits[sid]).length)
  const val   = (sku, f)    => edits[sku.id]?.[f] ?? String(sku[f] ?? '')
  const saveRow = (sku) => {
    const e = edits[sku.id]; if (!e || !Object.keys(e).length) return
    updateSku.mutate({ skuId: sku.id, data: { sku_code: e.sku_code ?? sku.sku_code, price: e.price ?? sku.price, qty: e.qty ?? sku.qty } })
  }

  const handleGenerate = async () => {
    const combos = cartesian(types)
    const hasVariants = combos.length > 0 && combos[0].length > 0
    if (!hasVariants) {
      if (skus.length > 0) { toast('SKU sudah ada', { icon: '✓' }); return }
      setGenerating(true)
      try { await productSkusApi.create(productId, {}); qc.invalidateQueries({ queryKey: ['product-skus', productId] }); toast.success('SKU dibuat') }
      catch (e) { toast.error(e.response?.data?.message || 'Gagal') }
      finally { setGenerating(false) }
      return
    }
    const existingKeys = new Set(skus.map(s => (s.ProductVariantOptions || []).map(o => o.id).sort().join(',')))
    const missing = combos.filter(c => !existingKeys.has(c.map(o => o.optionId).sort().join(',')))
    if (!missing.length) { toast('Semua kombinasi SKU sudah ada', { icon: '✓' }); return }
    setGenerating(true)
    try { for (const c of missing) await productSkusApi.create(productId, { variantOptionIds: c.map(o => o.optionId) }); qc.invalidateQueries({ queryKey: ['product-skus', productId] }); toast.success(`${missing.length} SKU baru dibuat`) }
    catch (e) { toast.error(e.response?.data?.message || 'Gagal') }
    finally { setGenerating(false) }
  }

  const toggleOption = (optId) => setManual(m => ({ ...m, variantOptionIds: m.variantOptionIds.includes(optId) ? m.variantOptionIds.filter(i => i !== optId) : [...m.variantOptionIds, optId] }))

  const variantLabel = (sku) => {
    const opts = sku.ProductVariantOptions || []
    if (!opts.length) return <span className="text-slate-400 italic text-xs">Tanpa variant</span>
    return <div className="flex flex-wrap gap-1">{opts.map((o, i) => <span key={o.id} className="inline-flex items-center gap-1 text-xs">{i > 0 && <span className="text-slate-300 mx-0.5">/</span>}<span className="font-medium text-slate-600">{o.value}</span><span className="text-slate-300 text-[10px]">({o.ProductVariantType?.name})</span></span>)}</div>
  }

  const totalQty = skus.reduce((s, k) => s + Number(k.qty || 0), 0)
  const prices   = skus.map(k => Number(k.price || 0)).filter(Boolean)
  const priceRangeStr = prices.length ? (prices.length > 1 ? `Rp ${Math.min(...prices).toLocaleString('id-ID')} – ${Math.max(...prices).toLocaleString('id-ID')}` : `Rp ${prices[0].toLocaleString('id-ID')}`) : null

  if (isLoading) return <div className="flex items-center gap-2 text-sm text-slate-400 py-4"><Loader2 size={14} className="animate-spin" /> Memuat SKU…</div>

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-4">
          {skus.length > 0 && <>
            <div className="text-center"><p className="text-lg font-bold text-slate-800">{skus.length}</p><p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">SKU</p></div>
            <div className="w-px h-8 bg-slate-200" />
            <div className="text-center"><p className="text-lg font-bold text-slate-800">{totalQty.toLocaleString('id-ID')}</p><p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Total Stok</p></div>
            {priceRangeStr && <><div className="w-px h-8 bg-slate-200" /><div><p className="text-sm font-bold text-slate-800">{priceRangeStr}</p><p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Harga</p></div></>}
          </>}
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => { setShowManual(v => !v); setManual(EMPTY_MANUAL) }} className="btn-secondary text-xs"><Pencil size={12} /> Tambah Manual</button>
          <button type="button" onClick={handleGenerate} disabled={generating} className="btn-secondary text-xs">{generating ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />} Generate dari Variant</button>
        </div>
      </div>

      {showManual && (
        <form onSubmit={e => { e.preventDefault(); createSku.mutate({ sku_code: manual.sku_code.trim() || undefined, price: Number(manual.price) || 0, qty: Number(manual.qty) || 0, variantOptionIds: manual.variantOptionIds }) }} className="mb-4 p-4 rounded-xl border border-brand/20 bg-brand/5 space-y-3">
          <p className="text-xs font-bold text-brand uppercase tracking-wide">Tambah SKU Manual</p>
          <div className="grid grid-cols-3 gap-3">
            <div><label className="label text-xs">SKU Code</label><input autoFocus className="input text-xs font-mono" placeholder="Kosongkan = auto" value={manual.sku_code} onChange={e => setManual(m => ({ ...m, sku_code: e.target.value }))} /></div>
            <div><label className="label text-xs">Harga (Rp)</label><input type="number" min="0" className="input text-xs" placeholder="0" value={manual.price} onChange={e => setManual(m => ({ ...m, price: e.target.value }))} /></div>
            <div><label className="label text-xs">Stok Awal</label><input type="number" min="0" className="input text-xs" placeholder="0" value={manual.qty} onChange={e => setManual(m => ({ ...m, qty: e.target.value }))} /></div>
          </div>
          {types.length > 0 && <div className="space-y-2"><p className="text-[11px] text-slate-500 font-semibold uppercase tracking-wide">Pilih Variant (opsional)</p>{types.map(t => <div key={t.id}><p className="text-[11px] text-slate-400 mb-1">{t.name}</p><div className="flex flex-wrap gap-1.5">{t.ProductVariantOptions?.map(opt => { const sel = manual.variantOptionIds.includes(opt.id); return <button key={opt.id} type="button" onClick={() => toggleOption(opt.id)} className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors ${sel ? 'bg-brand text-white border-brand' : 'bg-white text-slate-600 border-slate-200 hover:border-brand/40'}`}>{opt.value}</button> })}</div></div>)}</div>}
          <div className="flex gap-2 pt-1">
            <button type="submit" disabled={createSku.isPending} className="btn-primary text-xs">{createSku.isPending ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />} Simpan SKU</button>
            <button type="button" onClick={() => { setShowManual(false); setManual(EMPTY_MANUAL) }} className="btn-secondary text-xs"><X size={12} /> Batal</button>
          </div>
        </form>
      )}

      {skus.length > 0 && <p className="text-xs text-slate-400 mb-3 flex items-center gap-1.5"><AlertCircle size={11} /> Klik kolom untuk edit inline. Klik QR untuk generate barcode.</p>}

      {skus.length === 0 && !showManual ? (
        <div className="text-center py-12 rounded-xl border-2 border-dashed border-slate-200">
          <Hash size={32} className="mx-auto text-slate-200 mb-3" />
          <p className="text-sm font-semibold text-slate-400">Belum ada SKU</p>
          <p className="text-xs text-slate-300 mt-1">Klik <span className="font-medium text-slate-400">"Tambah Manual"</span> atau <span className="font-medium text-slate-400">"Generate dari Variant"</span></p>
        </div>
      ) : skus.length > 0 ? (
        <div className="rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr><th className="th">Variant</th><th className="th">SKU Code</th><th className="th text-right">Harga (Rp)</th><th className="th text-right">Stok</th><th className="th w-20" /></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {skus.map(sku => (
                <tr key={sku.id} className={`group transition-colors ${dirty(sku.id) ? 'bg-amber-50/50' : 'hover:bg-slate-50/60'}`}>
                  <td className="td">{variantLabel(sku)}</td>
                  <td className="td"><input value={val(sku, 'sku_code')} onChange={e => edit(sku.id, 'sku_code', e.target.value)} onBlur={() => saveRow(sku)} className="font-mono text-xs w-full bg-transparent focus:bg-white border border-transparent focus:border-brand/30 rounded px-2 py-1 focus:outline-none transition-all hover:border-slate-200" /></td>
                  <td className="td"><input type="number" min="0" value={val(sku, 'price')} onChange={e => edit(sku.id, 'price', e.target.value)} onBlur={() => saveRow(sku)} className="w-full bg-transparent focus:bg-white border border-transparent focus:border-brand/30 rounded px-2 py-1 text-right tabular-nums focus:outline-none transition-all hover:border-slate-200" /></td>
                  <td className="td"><input type="number" min="0" value={val(sku, 'qty')} onChange={e => edit(sku.id, 'qty', e.target.value)} onBlur={() => saveRow(sku)} className="w-20 bg-transparent focus:bg-white border border-transparent focus:border-brand/30 rounded px-2 py-1 text-right tabular-nums focus:outline-none transition-all hover:border-slate-200 ml-auto block" /></td>
                  <td className="td"><div className="flex items-center justify-end gap-0.5 transition-opacity"><button type="button" onClick={() => setQrSku(sku)} className="p-1.5 rounded text-slate-400 hover:text-violet-500 hover:bg-violet-50 transition-all"><QrCode size={13} /></button><button type="button" onClick={() => { if (confirm('Hapus SKU ini?')) deleteSku.mutate(sku.id) }} className="opacity-0 group-hover:opacity-100 p-1.5 rounded text-slate-300 hover:text-red-400 hover:bg-red-50 transition-all"><Trash2 size={13} /></button></div></td>
                </tr>
              ))}
            </tbody>
            {skus.length > 1 && (
              <tfoot className="bg-slate-50/80 border-t border-slate-200">
                <tr>
                  <td colSpan={2} className="px-4 py-2.5 text-xs font-semibold text-slate-500">Total</td>
                  <td className="px-4 py-2.5 text-xs font-bold text-slate-700 text-right tabular-nums">Rp {skus.reduce((s, k) => s + Number(k.price || 0), 0).toLocaleString('id-ID')}</td>
                  <td className="px-4 py-2.5 text-xs font-bold text-slate-700 text-right tabular-nums">{totalQty.toLocaleString('id-ID')}</td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      ) : null}
      {qrSku && <QrModal sku={qrSku} skuName={productName} onClose={() => setQrSku(null)} />}
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function ProductEdit() {
  const { id } = useParams()
  const isNew  = !id || id === 'new'
  const navigate = useNavigate()
  const qc       = useQueryClient()
  const [searchParams] = useSearchParams()
  const isSetup = !isNew && searchParams.get('setup') === 'true'

  const [form, setForm]               = useState(EMPTY_FORM)
  const [catError, setCatError]       = useState(false)
  const [unitError, setUnitError]     = useState(false)
  const [setupChoice, setSetupChoice] = useState(null)
  const [simpleForm, setSimpleForm]   = useState({ price: '', qty: '' })
  const [unitOptions, setUnitOptions] = useState(DEFAULT_UNITS)

  const { data: product, isLoading: productLoading } = useQuery({
    queryKey: ['product', id],
    queryFn:  () => productsApi.get(id),
    enabled:  !isNew,
  })

  useEffect(() => { if (isNew) setForm(EMPTY_FORM) }, [isNew])

  useEffect(() => {
    if (!product || isNew) return
    const unit = product.unit || ''
    setForm({ name: product.name || '', unit, CategoryId: product.CategoryId ?? '', ArticleId: product.ArticleId ?? '', image: null, imageUrl: product.imageUrl || '' })
    if (unit && !DEFAULT_UNITS.some(u => u.id === unit)) setUnitOptions(prev => prev.some(u => u.id === unit) ? prev : [...prev, { id: unit, name: unit }])
  }, [product?.id])

  const { data: cats } = useQuery({ queryKey: ['categories', { limit: 200 }], queryFn: () => categoriesApi.list({ limit: 200 }) })
  const { data: arts } = useQuery({ queryKey: ['articles',   { limit: 200 }], queryFn: () => articlesApi.list({ limit: 200 }) })
  const catOptions = cats?.data ?? []
  const artOptions = arts?.data ?? []

  const save = useMutation({
    mutationFn: (data) => isNew ? productsApi.create(data) : productsApi.update(id, data),
    onSuccess: (saved) => {
      qc.invalidateQueries({ queryKey: ['products'] })
      if (isNew) {
        toast.success('Produk berhasil dibuat')
        navigate(`/products/${saved.id}/edit?setup=true`, { replace: true })
      } else {
        qc.invalidateQueries({ queryKey: ['product', id] })
        toast.success('Perubahan disimpan')
        navigate(`/products/${id}`)
      }
    },
    onError: e => toast.error(e.response?.data?.message || 'Gagal menyimpan produk'),
  })

  const saveSimpleSku = useMutation({
    mutationFn: () => productSkusApi.create(id, { price: Number(simpleForm.price) || 0, qty: Number(simpleForm.qty) || 0 }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['products'] }); toast.success('Produk berhasil disimpan'); navigate(`/products/${id}`) },
    onError: e => toast.error(e.response?.data?.message || 'Gagal menyimpan harga'),
  })

  const createCategory = useMutation({
    mutationFn: name => categoriesApi.create({ name }),
    onSuccess: (c) => { qc.invalidateQueries({ queryKey: ['categories'] }); toast.success(`Kategori "${c.name}" ditambahkan`); return c },
    onError: e => { toast.error(e.response?.data?.message || 'Gagal'); throw e },
  })
  const createArticle = useMutation({
    mutationFn: name => articlesApi.create({ name }),
    onSuccess: (a) => { qc.invalidateQueries({ queryKey: ['articles'] }); toast.success(`Koleksi "${a.name}" ditambahkan`); return a },
    onError: e => { toast.error(e.response?.data?.message || 'Gagal'); throw e },
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.unit) { setUnitError(true); toast.error('Pilih satuan terlebih dahulu'); return }
    setUnitError(false)
    if (!form.CategoryId) { setCatError(true); toast.error('Pilih kategori terlebih dahulu'); return }
    setCatError(false)
    const payload = { ...form }
    if (!payload.ArticleId) payload.ArticleId = null
    if (!isNew && !payload.image && payload.imageUrl === (product?.imageUrl || '')) delete payload.imageUrl
    save.mutate(payload)
  }

  if (!isNew && productLoading) return <div className="flex items-center justify-center h-64"><Loader2 size={24} className="animate-spin text-slate-300" /></div>

  const pageTitle = isNew ? 'Produk Baru' : `Edit — ${product?.name || '…'}`
  const backPath  = isNew ? '/products' : `/products/${id}`

  return (
    <div className="min-h-screen bg-canvas">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 bg-white border-b border-slate-200 shadow-sm">
        <div className="flex items-center gap-4 px-6 h-14">
          <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-700 transition-colors flex-shrink-0">
            <ArrowLeft size={15} /> {isNew ? 'Products' : 'Detail Produk'}
          </button>
          <ChevronRight size={14} className="text-slate-200" />
          <h1 className="text-sm font-bold text-slate-800 flex-1 truncate">{pageTitle}</h1>

          {isSetup ? (
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => navigate(`/products/${id}`)} className="btn-secondary text-sm"><SkipForward size={14} /> Lewati</button>
              {setupChoice === 'variant' && <button type="button" onClick={() => navigate(`/products/${id}`)} className="btn-primary text-sm"><Check size={14} /> Selesai</button>}
              {setupChoice === 'simple' && <button type="button" onClick={() => saveSimpleSku.mutate()} disabled={saveSimpleSku.isPending} className="btn-primary text-sm">{saveSimpleSku.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Simpan & Selesai</button>}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              {!isNew && <button type="button" onClick={() => navigate(`/products/${id}`)} className="btn-secondary text-sm"><X size={14} /> Batal</button>}
              <button form="product-form" type="submit" disabled={save.isPending} className="btn-primary text-sm">
                {save.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                {isNew ? 'Buat Produk' : 'Simpan Perubahan'}
              </button>
            </div>
          )}
        </div>

        {isSetup && (
          <div className="px-6 pb-3 flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-brand">
              <span className="w-5 h-5 rounded-full bg-brand text-white flex items-center justify-center text-[10px]">✓</span>
              Info Produk
            </div>
            <div className="flex-1 h-px bg-slate-200 relative">
              <div className={`absolute inset-y-0 left-0 bg-brand transition-all ${setupChoice ? 'w-full' : 'w-0'}`} />
            </div>
            <div className={`flex items-center gap-1.5 text-xs font-semibold ${setupChoice ? 'text-brand' : 'text-slate-400'}`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${setupChoice ? 'bg-brand text-white' : 'bg-slate-200 text-slate-400'}`}>2</span>
              {setupChoice === 'simple' ? 'Harga & Stok' : 'Variant & Harga'}
            </div>
          </div>
        )}
      </div>

      {/* ── Content ─────────────────────────────────────────────────── */}
      <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">

        {/* Setup wizard */}
        {isSetup && (
          <>
            {setupChoice === null && (
              <div className="card p-10 flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-2xl bg-brand/10 flex items-center justify-center mb-5"><Layers size={32} className="text-brand" /></div>
                <h2 className="text-lg font-bold text-slate-800 mb-1">Produk ini menggunakan variant?</h2>
                <p className="text-sm text-slate-400 mb-8 max-w-sm">Variant digunakan jika produk memiliki pilihan seperti <span className="font-semibold text-slate-600">Ukuran</span> (S, M, L) atau <span className="font-semibold text-slate-600">Warna</span> (Merah, Biru).</p>
                <div className="flex gap-3">
                  <button type="button" onClick={() => setSetupChoice('variant')} className="btn-primary px-6 py-2.5 text-sm"><Layers size={15} /> Ya, Pakai Variant</button>
                  <button type="button" onClick={() => setSetupChoice('simple')} className="btn-secondary px-6 py-2.5 text-sm"><Hash size={15} /> Tidak, Langsung ke Harga</button>
                </div>
              </div>
            )}
            {setupChoice === 'variant' && (
              <>
                <Section icon={Layers} title="Variant Produk" subtitle="Tambah tipe variant seperti Ukuran atau Warna, lalu isi opsi-opsinya"><VariantBuilder productId={id} /></Section>
                <Section icon={Hash} title="SKU & Harga" subtitle="Generate SKU dari variant lalu isi harga dan stok"><SkuTable productId={id} productName={form.name} /></Section>
                <div className="flex justify-end pb-4"><button type="button" onClick={() => navigate(`/products/${id}`)} className="btn-primary px-6"><Check size={14} /> Selesai</button></div>
              </>
            )}
            {setupChoice === 'simple' && (
              <Section icon={Hash} title="Harga & Stok Awal" subtitle="Isi harga jual dan stok awal produk">
                <div className="max-w-xs space-y-5">
                  <div><label className="label">Harga Jual (Rp) <span className="text-red-400">*</span></label><input autoFocus type="number" min="0" className="input" placeholder="0" value={simpleForm.price} onChange={e => setSimpleForm(f => ({ ...f, price: e.target.value }))} /></div>
                  <div><label className="label">Stok Awal</label><input type="number" min="0" className="input" placeholder="0" value={simpleForm.qty} onChange={e => setSimpleForm(f => ({ ...f, qty: e.target.value }))} /></div>
                  <button type="button" onClick={() => saveSimpleSku.mutate()} disabled={saveSimpleSku.isPending} className="btn-primary w-full justify-center">{saveSimpleSku.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Simpan & Selesai</button>
                  <button type="button" onClick={() => setSetupChoice(null)} className="btn-secondary w-full justify-center text-sm">← Kembali</button>
                </div>
              </Section>
            )}
          </>
        )}

        {/* Normal edit (not setup) */}
        {!isSetup && (
          <>
            <Section icon={Package} title="Informasi Produk" subtitle="Nama, kategori, koleksi, dan foto produk">
              <form id="product-form" onSubmit={handleSubmit}>
                <div className="grid grid-cols-3 gap-6">
                  <div className="col-span-1">
                    <label className="label mb-2">Foto Produk</label>
                    <ImageUploader image={form.image} imageUrl={form.imageUrl} onChange={(file, url) => setForm(f => ({ ...f, image: file, imageUrl: url }))} onClear={() => setForm(f => ({ ...f, image: null, imageUrl: '' }))} />
                  </div>
                  <div className="col-span-2 flex flex-col gap-4">
                    <div>
                      <label className="label">Nama Produk <span className="text-red-400">*</span></label>
                      <input autoFocus={isNew} required className="input" placeholder="Masukkan nama produk" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                    </div>
                    <CreatableSelect label="Unit / Satuan" required error={unitError} value={form.unit} onChange={val => { setForm(f => ({ ...f, unit: val })); setUnitError(false) }} options={unitOptions} placeholder="Pilih atau buat satuan…" createLabel="Satuan Baru" onCreateNew={async name => { const o = { id: name, name }; setUnitOptions(p => [...p, o]); return o }} />
                    <CreatableSelect label="Kategori" required error={catError} value={form.CategoryId} onChange={val => { setForm(f => ({ ...f, CategoryId: val })); setCatError(false) }} options={catOptions} placeholder="Pilih atau buat kategori…" createLabel="Tambah Kategori" onCreateNew={name => createCategory.mutateAsync(name)} />
                    <CreatableSelect label="Koleksi (opsional)" value={form.ArticleId} onChange={artId => setForm(f => ({ ...f, ArticleId: artId }))} options={artOptions} placeholder="Pilih atau buat koleksi…" createLabel="Add New Koleksi" onCreateNew={name => createArticle.mutateAsync(name)} />
                  </div>
                </div>
              </form>
            </Section>

            {!isNew && (
              <>
                <Section icon={Layers} title="Variant Produk" subtitle="Tambah tipe variant seperti Ukuran atau Warna, lalu isi opsi-opsinya"><VariantBuilder productId={id} /></Section>
                <Section icon={Hash} title="SKU & Harga" subtitle="Setiap kombinasi variant memiliki SKU, harga, dan stok tersendiri"><SkuTable productId={id} productName={form.name} /></Section>
              </>
            )}

            {isNew && (
              <div className="text-center py-10 rounded-xl border-2 border-dashed border-slate-200 bg-white">
                <Layers size={28} className="mx-auto text-slate-200 mb-2" />
                <p className="text-sm font-semibold text-slate-400">Simpan produk terlebih dahulu</p>
                <p className="text-xs text-slate-300 mt-1">Variant dan SKU bisa dikelola setelah produk berhasil dibuat</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
