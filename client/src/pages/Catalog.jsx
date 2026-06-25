import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { categoriesApi, articlesApi, requestTypeApi } from '../api'
import { Pagination } from '../components/Table'
import SearchBar from '../components/SearchBar'
import toast from 'react-hot-toast'
import { Plus, Pencil, Trash2, Check, X, Loader2, Tag, BookOpen, Building2, Truck, FileText } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useSelectedCompany } from '../context/SelectedCompanyContext'

// ── Inline-editable row ────────────────────────────────────────────────────────

function EditableRow({ item, onSave, onDelete, disabled }) {
  const [editing, setEditing] = useState(false)
  const [name, setName]       = useState(item.name)
  const [saving, setSaving]   = useState(false)

  const handleSave = async () => {
    const trimmed = name.trim()
    if (!trimmed || trimmed === item.name) { setEditing(false); setName(item.name); return }
    setSaving(true)
    try {
      await onSave(item.id, trimmed)
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter')  { e.preventDefault(); handleSave() }
    if (e.key === 'Escape') { setEditing(false); setName(item.name) }
  }

  return (
    <tr className="group border-b border-slate-100 last:border-0 hover:bg-slate-50/60 transition-colors">
      <td className="px-4 py-3">
        {editing ? (
          <input
            autoFocus
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={handleKeyDown}
            className="input py-1 text-sm w-full max-w-xs"
          />
        ) : (
          <span className="text-sm font-medium text-slate-700">{item.name}</span>
        )}
      </td>
      <td className="px-4 py-3 text-right">
        {editing ? (
          <div className="flex items-center justify-end gap-1">
            <button
              onClick={handleSave}
              disabled={saving}
              className="p-1.5 rounded bg-brand text-white hover:bg-brand/90 disabled:opacity-40"
            >
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
            </button>
            <button
              onClick={() => { setEditing(false); setName(item.name) }}
              className="p-1.5 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100"
            >
              <X size={13} />
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-end gap-1">
            {!disabled && (
              <>
                <button
                  onClick={() => setEditing(true)}
                  className="p-1.5 rounded text-slate-400 hover:text-brand hover:bg-brand/5 transition-colors"
                  title="Edit"
                >
                  <Pencil size={13} />
                </button>
                <button
                  onClick={() => onDelete(item.id, item.name)}
                  className="p-1.5 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                  title="Hapus"
                >
                  <Trash2 size={13} />
                </button>
              </>
            )}
          </div>
        )}
      </td>
    </tr>
  )
}

// ── Add row ────────────────────────────────────────────────────────────────────

function AddRow({ onAdd, placeholder, disabled }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)

  const handleAdd = async () => {
    const trimmed = name.trim()
    if (!trimmed) return
    setSaving(true)
    try {
      await onAdd(trimmed)
      setName('')
      setOpen(false)
    } finally {
      setSaving(false)
    }
  }

  if (!open) return (
    <tr>
      <td colSpan={2} className="px-4 py-2">
        {!disabled && (
          <button
            onClick={() => setOpen(true)}
            className="flex items-center gap-1.5 text-sm text-brand hover:text-brand/80 font-medium transition-colors"
          >
            <Plus size={14} /> Tambah baru
          </button>
        )}
      </td>
    </tr>
  )

  return (
    <tr className="bg-brand/5 border-b border-brand/20">
      <td className="px-4 py-2">
        <input
          autoFocus
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter')  { e.preventDefault(); handleAdd() }
            if (e.key === 'Escape') { setOpen(false); setName('') }
          }}
          placeholder={placeholder}
          className="input py-1 text-sm w-full max-w-xs"
        />
      </td>
      <td className="px-4 py-2 text-right">
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={handleAdd}
            disabled={!name.trim() || saving}
            className="p-1.5 rounded bg-brand text-white hover:bg-brand/90 disabled:opacity-40"
          >
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
          </button>
          <button
            onClick={() => { setOpen(false); setName('') }}
            className="p-1.5 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100"
          >
            <X size={13} />
          </button>
        </div>
      </td>
    </tr>
  )
}

// ── Section table ──────────────────────────────────────────────────────────────

function CatalogTable({ title, icon: Icon, data, pagination, isLoading, onAdd, onSave, onDelete, placeholder, search, onSearch, onPageChange, disabled }) {
  const items = data ?? []
  const total = pagination?.total ?? items.length

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100">
        <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 flex-shrink-0">
          <Icon size={15} />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-bold text-slate-800">{title}</h3>
          <p className="text-xs text-slate-400">{total} item</p>
        </div>
      </div>

      <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50/50">
        <SearchBar value={search} onChange={v => { onSearch(v) }} placeholder={`Cari ${title.toLowerCase()}…`} />
      </div>

      {isLoading ? (
        <div className="p-6 space-y-3">
          {[1,2,3].map(i => <div key={i} className="h-8 bg-slate-100 rounded animate-pulse" />)}
        </div>
      ) : (
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">Nama</th>
              <th className="px-4 py-2.5 w-24" />
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr>
                <td colSpan={2} className="px-4 py-8 text-center text-sm text-slate-300">
                  {search ? 'Tidak ada hasil' : 'Belum ada data'}
                </td>
              </tr>
            )}
            {items.map(item => (
              <EditableRow
                key={item.id}
                item={item}
                onSave={onSave}
                onDelete={onDelete}
                disabled={disabled}
              />
            ))}
            <AddRow onAdd={onAdd} placeholder={placeholder} disabled={disabled} />
          </tbody>
        </table>
      )}

      <Pagination pagination={pagination} onPageChange={onPageChange} />
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function Catalog() {
  const qc = useQueryClient()
  const { isSuperAdmin } = useAuth()
  const { selectedCompany } = useSelectedCompany()
  const blocked = isSuperAdmin && !selectedCompany

  const [catPage, setCatPage] = useState(1)
  const [catSearch, setCatSearch] = useState('')
  const [artPage, setArtPage] = useState(1)
  const [artSearch, setArtSearch] = useState('')

  // ── Categories ─────────────────────────────────────────────────────────────
  const { data: catData, isLoading: catLoading } = useQuery({
    queryKey: ['categories', { page: catPage, name: catSearch, companyId: selectedCompany?.id }],
    queryFn:  () => categoriesApi.list({ page: catPage, limit: 8, name: catSearch || undefined }),
  })

  const addCat = useMutation({
    mutationFn: name => categoriesApi.create({ name }),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['categories'] }); toast.success('Kategori ditambahkan') },
    onError:    e  => toast.error(e.response?.data?.message || 'Gagal menambah kategori'),
  })
  const saveCat = useMutation({
    mutationFn: ([id, name]) => categoriesApi.update(id, { name }),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['categories'] }); toast.success('Kategori diperbarui') },
    onError:    e  => toast.error(e.response?.data?.message || 'Gagal memperbarui'),
  })
  const delCat = useMutation({
    mutationFn: id => categoriesApi.remove(id),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['categories'] }); toast.success('Kategori dihapus') },
    onError:    e  => toast.error(e.response?.data?.message || 'Gagal menghapus — mungkin masih dipakai produk'),
  })

  // ── Articles ───────────────────────────────────────────────────────────────
  const { data: artData, isLoading: artLoading } = useQuery({
    queryKey: ['articles', { page: artPage, name: artSearch, companyId: selectedCompany?.id }],
    queryFn:  () => articlesApi.list({ page: artPage, limit: 8, name: artSearch || undefined }),
  })

  const addArt = useMutation({
    mutationFn: name => articlesApi.create({ name }),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['articles'] }); toast.success('Koleksi ditambahkan') },
    onError:    e  => toast.error(e.response?.data?.message || 'Gagal menambah koleksi'),
  })
  const saveArt = useMutation({
    mutationFn: ([id, name]) => articlesApi.update(id, { name }),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['articles'] }); toast.success('Koleksi diperbarui') },
    onError:    e  => toast.error(e.response?.data?.message || 'Gagal memperbarui'),
  })
  const delArt = useMutation({
    mutationFn: id => articlesApi.remove(id),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['articles'] }); toast.success('Koleksi dihapus') },
    onError:    e  => toast.error(e.response?.data?.message || 'Gagal menghapus — mungkin masih dipakai produk'),
  })

  // ── Request Types ──────────────────────────────────────────────────────────
  const { data: reqTypes, isLoading: reqTypesLoading } = useQuery({
    queryKey: ['request-types'],
    queryFn:  requestTypeApi.list,
  })
  const [newReqTypeName, setNewReqTypeName] = useState('')
  const [newReqTypeShipping, setNewReqTypeShipping] = useState(false)

  const addReqType = useMutation({
    mutationFn: () => requestTypeApi.create({ name: newReqTypeName.trim(), requiresShipping: newReqTypeShipping }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['request-types'] }); setNewReqTypeName(''); setNewReqTypeShipping(false); toast.success('Jenis pengajuan ditambahkan') },
    onError: e => toast.error(e.response?.data?.message || 'Gagal menambah'),
  })
  const toggleReqTypeShipping = useMutation({
    mutationFn: ([id, val]) => requestTypeApi.update(id, { requiresShipping: val }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['request-types'] }),
    onError: e => toast.error(e.response?.data?.message || 'Gagal update'),
  })
  const delReqType = useMutation({
    mutationFn: id => requestTypeApi.destroy(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['request-types'] }); toast.success('Jenis pengajuan dihapus') },
    onError: e => toast.error(e.response?.data?.message || 'Gagal menghapus'),
  })

  const confirmDelete = (mutate) => (id, name) => {
    if (confirm(`Hapus "${name}"? Produk yang menggunakan ini akan kehilangan referensinya.`)) {
      mutate(id)
    }
  }

  return (
    <div className="px-6 py-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-800">Kategori dan Koleksi</h2>
        <p className="text-sm text-slate-400 mt-0.5">Kelola kategori, koleksi, dan jenis pengajuan</p>
      </div>

      {blocked && (
        <div className="flex items-center gap-3 px-4 py-3.5 rounded-xl border border-amber-200 bg-amber-50 text-amber-800">
          <Building2 size={16} className="text-amber-500 flex-shrink-0" />
          <p className="text-sm font-medium">
            Pilih perusahaan di bagian atas terlebih dahulu untuk bisa menambah atau mengubah data artikel dan koleksi.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <CatalogTable
          title="Kategori"
          icon={Tag}
          data={catData?.data}
          pagination={catData?.pagination}
          isLoading={catLoading}
          placeholder="Nama kategori baru…"
          search={catSearch}
          onSearch={v => { setCatSearch(v); setCatPage(1) }}
          onPageChange={setCatPage}
          onAdd={name => addCat.mutateAsync(name)}
          onSave={(id, name) => saveCat.mutateAsync([id, name])}
          onDelete={confirmDelete(delCat.mutate)}
          disabled={blocked}
        />

        <CatalogTable
          title="Koleksi"
          icon={BookOpen}
          data={artData?.data}
          pagination={artData?.pagination}
          isLoading={artLoading}
          placeholder="Nama koleksi baru…"
          search={artSearch}
          onSearch={v => { setArtSearch(v); setArtPage(1) }}
          onPageChange={setArtPage}
          onAdd={name => addArt.mutateAsync(name)}
          onSave={(id, name) => saveArt.mutateAsync([id, name])}
          onDelete={confirmDelete(delArt.mutate)}
          disabled={blocked}
        />
      </div>

      {/* Request Types */}
      <div className="card overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100">
          <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 flex-shrink-0">
            <FileText size={15} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800">Jenis Pengajuan</h3>
            <p className="text-xs text-slate-400">{(reqTypes ?? []).length} jenis · Atur mana yang butuh pengiriman fisik</p>
          </div>
        </div>

        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/50">
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">Nama</th>
              <th className="px-4 py-2.5 text-center text-xs font-semibold text-slate-400 uppercase tracking-wide w-36">Butuh Kirim?</th>
              <th className="px-4 py-2.5 w-16" />
            </tr>
          </thead>
          <tbody>
            {reqTypesLoading ? (
              <tr><td colSpan={3} className="px-4 py-6 text-center text-sm text-slate-400">Memuat…</td></tr>
            ) : (reqTypes ?? []).map(t => (
              <tr key={t.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60">
                <td className="px-4 py-3 text-sm font-medium text-slate-700">{t.name}</td>
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => toggleReqTypeShipping.mutate([t.id, !t.requiresShipping])}
                    className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium transition-colors ${
                      t.requiresShipping
                        ? 'bg-violet-100 text-violet-700 hover:bg-violet-200'
                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                    }`}
                  >
                    <Truck size={10} />
                    {t.requiresShipping ? 'Ya' : 'Tidak'}
                  </button>
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => { if (confirm(`Hapus jenis "${t.name}"?`)) delReqType.mutate(t.id) }}
                    className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                  >
                    <Trash2 size={13} />
                  </button>
                </td>
              </tr>
            ))}
            {/* Add row */}
            <tr className="border-t border-slate-100 bg-slate-50/30">
              <td className="px-4 py-2.5">
                <input
                  value={newReqTypeName}
                  onChange={e => setNewReqTypeName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && newReqTypeName.trim() && addReqType.mutate()}
                  placeholder="Nama jenis baru…"
                  className="input py-1 text-sm w-full max-w-xs"
                />
              </td>
              <td className="px-4 py-2.5 text-center">
                <button
                  onClick={() => setNewReqTypeShipping(v => !v)}
                  className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium transition-colors ${
                    newReqTypeShipping ? 'bg-violet-100 text-violet-700' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  <Truck size={10} />
                  {newReqTypeShipping ? 'Ya' : 'Tidak'}
                </button>
              </td>
              <td className="px-4 py-2.5 text-right">
                <button
                  onClick={() => newReqTypeName.trim() && addReqType.mutate()}
                  disabled={!newReqTypeName.trim() || addReqType.isPending || blocked}
                  className="p-1.5 rounded bg-brand text-white hover:bg-brand/90 disabled:opacity-40"
                >
                  {addReqType.isPending ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
