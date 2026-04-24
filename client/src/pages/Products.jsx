import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { productsApi, categoriesApi } from '../api'
import PageHeader from '../components/PageHeader'
import { Table, Pagination } from '../components/Table'
import Modal from '../components/Modal'
import QRLabel from '../components/QRLabel'
import SearchBar from '../components/SearchBar'
import toast from 'react-hot-toast'
import { Plus, Pencil, Trash2, QrCode, Printer, X, ImageIcon, Upload } from 'lucide-react'

const EMPTY = { name: '', sku: '', barcode: '', qrString: '', unit: '', CategoryId: '', image: null, imageUrl: '' }
const MAX_IMAGE_BYTES = 5 * 1024 * 1024 // 5 MB — must match backend multer limit

// ── Image uploader ────────────────────────────────────────────────────────────

function ImageUploader({ image, imageUrl, onChange, onClear }) {
  const inputRef = useRef(null)

  const handleFile = (file) => {
    if (!file) return
    if (!file.type.startsWith('image/')) return toast.error('File harus berupa gambar')
    if (file.size > MAX_IMAGE_BYTES)     return toast.error('Ukuran file maksimal 5MB')
    onChange(file, URL.createObjectURL(file))
  }

  const handleDrop = (e) => {
    e.preventDefault()
    handleFile(e.dataTransfer.files?.[0])
  }

  const preview = image ? imageUrl : imageUrl || null

  return (
    <div
      onDragOver={e => e.preventDefault()}
      onDrop={handleDrop}
      className="flex items-center gap-3 p-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 hover:border-brand/40 transition-colors"
    >
      {preview ? (
        <img src={preview} alt="preview" className="w-20 h-20 rounded-lg object-cover border border-slate-200 flex-shrink-0" />
      ) : (
        <div className="w-20 h-20 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-400 flex-shrink-0">
          <ImageIcon size={28} />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-700 truncate">
          {image ? image.name : preview ? 'Foto tersimpan' : 'Belum ada foto'}
        </p>
        <p className="text-xs text-slate-400 mt-0.5">Drag & drop atau klik tombol di samping. JPG/PNG/WEBP.</p>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={e => handleFile(e.target.files?.[0])}
        />
        <div className="flex gap-2 mt-2">
          <button type="button" onClick={() => inputRef.current?.click()} className="btn-secondary text-xs">
            <Upload size={12} /> {preview ? 'Ganti' : 'Pilih Foto'}
          </button>
          {preview && (
            <button type="button" onClick={onClear} className="btn-secondary text-xs text-danger hover:bg-danger-light">
              <X size={12} /> Hapus
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Print overlay component ───────────────────────────────────────────────────

// Per-mode config — pageSize matches CSS @page, qrSize is pixel size passed to QRCode
const PRINT_MODES = {
  a4:        { label: 'A4 (4 per baris)',  pageSize: 'A4',         qrSize: 100, hint: '4 label per baris — hemat kertas' },
  thermal58: { label: 'Thermal 58mm',      pageSize: '58mm auto',  qrSize: 140, hint: 'Panjang ke bawah — sobek antar label' },
  thermal80: { label: 'Thermal 80mm',      pageSize: '80mm auto',  qrSize: 200, hint: 'Panjang ke bawah — sobek antar label' },
}

const QTY_PRESETS = [1, 10, 50, 100, 200]
const MAX_QTY_PER_SKU = 1000

function PrintModal({ products, onClose }) {
  const [mode, setMode] = useState('a4')
  const [qty, setQty]   = useState(() => Object.fromEntries(products.map(p => [p.id, 1])))
  const cfg = PRINT_MODES[mode]

  const setOne = (id, n) => {
    const clamped = Math.max(1, Math.min(MAX_QTY_PER_SKU, Number(n) || 1))
    setQty(prev => ({ ...prev, [id]: clamped }))
  }
  const setAll = (n) => setQty(Object.fromEntries(products.map(p => [p.id, n])))

  const totalLabels = products.reduce((s, p) => s + (qty[p.id] || 1), 0)

  // Repeat each product by its qty. Use a stable unique key so React doesn't
  // re-mount all copies on qty change.
  const expandedLabels = products.flatMap(p => {
    const n = qty[p.id] || 1
    return Array.from({ length: n }, (_, i) => ({ product: p, key: `${p.id}-${i}` }))
  })

  const handlePrint = () => {
    if (totalLabels > 2000) {
      if (!confirm(`Kamu akan ngeprint ${totalLabels} label. Yakin?`)) return
    }
    const styleEl = document.createElement('style')
    styleEl.id = 'print-page-size'
    styleEl.textContent = `@media print { @page { size: ${cfg.pageSize}; margin: 0; } }`
    document.head.appendChild(styleEl)

    const cleanup = () => { styleEl.remove(); window.removeEventListener('afterprint', cleanup) }
    window.addEventListener('afterprint', cleanup)
    window.print()
    setTimeout(cleanup, 10000)
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex flex-col">
      {/* Toolbar — hidden during print */}
      <div className="flex items-center justify-between px-6 py-3 bg-white border-b border-slate-200 flex-shrink-0 gap-4">
        <div>
          <p className="font-semibold text-slate-800 text-sm">
            {totalLabels} Label QR <span className="text-slate-400 font-normal">({products.length} SKU)</span>
          </p>
          <p className="text-xs text-slate-400">{cfg.hint}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
            {Object.entries(PRINT_MODES).map(([k, v]) => (
              <button
                key={k}
                onClick={() => setMode(k)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  mode === k ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {v.label}
              </button>
            ))}
          </div>
          <button onClick={onClose} className="btn-secondary"><X size={14} /> Batal</button>
          <button onClick={handlePrint} className="btn-primary"><Printer size={14} /> Print {totalLabels}</button>
        </div>
      </div>

      {/* Qty panel */}
      <div className="px-6 py-3 bg-white border-b border-slate-200 flex-shrink-0">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Jumlah per SKU</span>
          <span className="text-xs text-slate-400">Set semua ke:</span>
          {QTY_PRESETS.map(n => (
            <button
              key={n}
              onClick={() => setAll(n)}
              className="px-2.5 py-1 rounded-md border border-slate-200 bg-white text-xs font-medium text-slate-600 hover:border-brand/40 hover:text-brand hover:bg-brand/5 transition-colors"
            >
              {n}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 max-h-28 overflow-y-auto">
          {products.map(p => (
            <div key={p.id} className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-700 truncate max-w-[180px]">{p.name}</p>
                <p className="text-[10px] font-mono text-slate-400">{p.sku}</p>
              </div>
              <input
                type="number"
                min="1"
                max={MAX_QTY_PER_SKU}
                value={qty[p.id] ?? 1}
                onChange={e => setOne(p.id, e.target.value)}
                className="w-16 px-2 py-1 rounded-md border border-slate-200 bg-white text-sm font-mono text-center focus:outline-none focus:border-brand/60"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Preview scroll area */}
      <div className="flex-1 overflow-y-auto bg-slate-100 p-6">
        <div className={`qr-print-content qr-print-${mode}`}>
          <div className="qr-label-grid">
            {expandedLabels.map(({ product, key }) => (
              <QRLabel key={key} product={product} size={cfg.qrSize} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function Products() {
  const qc = useQueryClient()
  const [page, setPage]       = useState(1)
  const [search, setSearch]   = useState('')
  const [catFilter, setCat]   = useState('')
  const [modal, setModal]     = useState(null)
  const [form, setForm]       = useState(EMPTY)
  const [selected, setSelected] = useState(new Set())
  const [printProducts, setPrintProducts] = useState(null) // array → open print modal

  const { data, isLoading } = useQuery({
    queryKey: ['products', { page, name: search, CategoryId: catFilter }],
    queryFn:  () => productsApi.list({ page, limit: 10, name: search, CategoryId: catFilter || undefined }),
  })
  const { data: cats } = useQuery({
    queryKey: ['categories', { limit: 100 }],
    queryFn:  () => categoriesApi.list({ limit: 100 }),
  })

  const save = useMutation({
    mutationFn: d => modal.data ? productsApi.update(modal.data.id, d) : productsApi.create(d),
    onSuccess: () => { qc.invalidateQueries(['products']); toast.success(modal.data ? 'Product updated' : 'Product created'); setModal(null) },
    onError: e => toast.error(e.response?.data?.message || 'Error'),
  })
  const del = useMutation({
    mutationFn: id => productsApi.remove(id),
    onSuccess: () => { qc.invalidateQueries(['products']); toast.success('Product deleted'); setModal(null) },
    onError: e => toast.error(e.response?.data?.message || 'Error'),
  })

  // ── Selection helpers ────────────────────────────────────────────────────

  const rows = data?.data ?? []
  const allSelected = rows.length > 0 && rows.every(r => selected.has(r.id))

  const toggleRow = (id) => setSelected(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })

  const toggleAll = () => {
    if (allSelected) {
      setSelected(prev => { const next = new Set(prev); rows.forEach(r => next.delete(r.id)); return next })
    } else {
      setSelected(prev => { const next = new Set(prev); rows.forEach(r => next.add(r.id)); return next })
    }
  }

  const selectedRows = rows.filter(r => selected.has(r.id))

  const openBulkPrint = () => {
    if (!selectedRows.length) return toast.error('Pilih minimal 1 produk')
    setPrintProducts(selectedRows)
  }

  const openSinglePrint = (product) => setPrintProducts([product])

  // ── Columns ─────────────────────────────────────────────────────────────

  const columns = [
    {
      key: 'select', label: (
        <input
          type="checkbox"
          checked={allSelected}
          onChange={toggleAll}
          className="rounded border-slate-300 accent-brand cursor-pointer"
        />
      ), width: 44,
      render: r => (
        <input
          type="checkbox"
          checked={selected.has(r.id)}
          onChange={() => toggleRow(r.id)}
          className="rounded border-slate-300 accent-brand cursor-pointer"
          onClick={e => e.stopPropagation()}
        />
      ),
    },
    {
      key: 'name', label: 'Produk',
      render: r => (
        <div className="flex items-center gap-3">
          {r.imageUrl ? (
            <img
              src={r.imageUrl}
              alt={r.name}
              className="w-10 h-10 rounded-lg object-cover border border-slate-200 flex-shrink-0"
            />
          ) : (
            <div className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center flex-shrink-0 text-slate-400">
              <ImageIcon size={16} />
            </div>
          )}
          <div className="min-w-0">
            <p className="font-semibold text-slate-800 truncate">{r.name}</p>
            <p className="text-xs font-mono text-slate-400 truncate">{r.sku}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'category', label: 'Kategori',
      render: r => r.Category
        ? <span className="badge-teal">{r.Category.name}</span>
        : <span className="text-slate-300">—</span>,
    },
    {
      key: 'barcode', label: 'Barcode',
      render: r => <span className="font-mono text-xs text-slate-500">{r.barcode || '—'}</span>,
    },
    { key: 'unit', label: 'Unit', width: 80, render: r => <span className="badge-muted">{r.unit}</span> },
    {
      key: 'actions', label: '', width: 100,
      render: r => (
        <div className="flex items-center gap-1">
          <button
            onClick={() => openSinglePrint(r)}
            className="p-1.5 rounded text-slate-400 hover:text-brand hover:bg-brand/5 transition-colors"
            title="Print QR Label"
          >
            <QrCode size={13} />
          </button>
          <button
            onClick={() => { setForm({ name: r.name, sku: r.sku, barcode: r.barcode || '', qrString: r.qrString || '', unit: r.unit, CategoryId: r.CategoryId, image: null, imageUrl: r.imageUrl || '' }); setModal({ mode: 'edit', data: r }) }}
            className="btn-edit"
            title="Edit"
          >
            <Pencil size={13} />
          </button>
          <button
            onClick={() => setModal({ mode: 'delete', data: r })}
            className="p-1.5 rounded text-slate-400 hover:text-danger hover:bg-danger-light transition-colors"
            title="Delete"
          >
            <Trash2 size={13} />
          </button>
        </div>
      ),
    },
  ]

  const F = ({ k, label, type = 'text', ...rest }) => (
    <div>
      <label className="label">{label}</label>
      {type === 'select' ? (
        <select className="select" value={form[k]} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} {...rest}>
          <option value="">Pilih kategori…</option>
          {cats?.data?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      ) : (
        <input type={type} className="input" value={form[k]} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} {...rest} />
      )}
    </div>
  )

  return (
    <div className="px-6 py-6">
      <PageHeader
        title="Products"
        subtitle={`${data?.pagination?.total ?? 0} total products`}
        action={
          <div className="flex items-center gap-2">
            {selected.size > 0 && (
              <button onClick={openBulkPrint} className="btn-secondary">
                <Printer size={14} /> Print {selected.size} Label
              </button>
            )}
            <button
              onClick={() => { setForm(EMPTY); setModal({ mode: 'create' }) }}
              className="btn-primary"
            >
              <Plus size={14} /> Add Product
            </button>
          </div>
        }
      />

      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
          <SearchBar value={search} onChange={v => { setSearch(v); setPage(1) }} placeholder="Search products…" />
          <select className="select w-44" value={catFilter} onChange={e => { setCat(e.target.value); setPage(1) }}>
            <option value="">All categories</option>
            {cats?.data?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <Table columns={columns} data={rows} loading={isLoading} />
        <Pagination pagination={data?.pagination} onPageChange={p => { setPage(p); setSelected(new Set()) }} />
      </div>

      {/* ── Create / Edit modal ─────────────────────────────────────────── */}
      <Modal
        open={['create', 'edit'].includes(modal?.mode)}
        onClose={() => setModal(null)}
        title={modal?.mode === 'edit' ? 'Edit Product' : 'New Product'}
        size="lg"
      >
        <form onSubmit={e => {
          e.preventDefault()
          // When editing and user cleared image, send explicit empty string so
          // backend knows to null out imageUrl. When no change, don't send it.
          const payload = { ...form }
          if (modal?.mode === 'edit' && !payload.image && payload.imageUrl === (modal.data.imageUrl || '')) {
            delete payload.imageUrl
          }
          save.mutate(payload)
        }}>
          <div className="grid grid-cols-2 gap-4 mb-5">
            <div className="col-span-2">
              <label className="label">Foto Produk <span className="text-slate-400 font-normal">(opsional, max 5MB)</span></label>
              <ImageUploader
                image={form.image}
                imageUrl={form.imageUrl}
                onChange={(file, previewUrl) => setForm(f => ({ ...f, image: file, imageUrl: previewUrl }))}
                onClear={() => setForm(f => ({ ...f, image: null, imageUrl: '' }))}
              />
            </div>
            <div className="col-span-2"><F k="name" label="Product Name" required autoFocus /></div>
            <F k="sku"      label="SKU" required placeholder="SKU-001" />
            <F k="unit"     label="Unit" placeholder="pcs, box, kg…" required />
            <F k="barcode"  label="Barcode" placeholder="Barcode angka (opsional)" />
            <F k="qrString" label="QR String" placeholder="Kosongkan = gunakan SKU" />
            <div className="col-span-2"><F k="CategoryId" label="Category" type="select" required /></div>
          </div>
          <div className="flex gap-2 pt-4 border-t border-slate-100">
            <button type="button" onClick={() => setModal(null)} className="btn-secondary flex-1 justify-center">Cancel</button>
            <button type="submit" disabled={save.isPending} className="btn-primary flex-1 justify-center">
              {save.isPending ? 'Saving…' : 'Save Product'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Delete modal ────────────────────────────────────────────────── */}
      <Modal open={modal?.mode === 'delete'} onClose={() => setModal(null)} title="Delete Product" size="sm">
        <p className="text-sm text-slate-600 mb-5">
          Delete <span className="font-semibold text-slate-800">"{modal?.data?.name}"</span>? This cannot be undone.
        </p>
        <div className="flex gap-2">
          <button onClick={() => setModal(null)} className="btn-secondary flex-1 justify-center">Cancel</button>
          <button onClick={() => del.mutate(modal.data.id)} disabled={del.isPending} className="btn-danger flex-1 justify-center">
            {del.isPending ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </Modal>

      {/* ── Print modal ─────────────────────────────────────────────────── */}
      {printProducts && (
        <PrintModal products={printProducts} onClose={() => setPrintProducts(null)} />
      )}
    </div>
  )
}
