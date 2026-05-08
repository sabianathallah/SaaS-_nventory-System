import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { categoriesApi, articlesApi } from '../api'
import { Pagination } from '../components/Table'
import SearchBar from '../components/SearchBar'
import toast from 'react-hot-toast'
import { Plus, Pencil, Trash2, Check, X, Loader2, Tag, BookOpen, Building2 } from 'lucide-react'
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
          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
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
    queryKey: ['categories', { page: catPage, name: catSearch }],
    queryFn:  () => categoriesApi.list({ page: catPage, limit: 8, name: catSearch || undefined }),
  })

  const addCat = useMutation({
    mutationFn: name => categoriesApi.create({ name }),
    onSuccess:  () => { qc.invalidateQueries(['categories']); toast.success('Tipe ditambahkan') },
    onError:    e  => toast.error(e.response?.data?.message || 'Gagal menambah tipe'),
  })
  const saveCat = useMutation({
    mutationFn: ([id, name]) => categoriesApi.update(id, { name }),
    onSuccess:  () => { qc.invalidateQueries(['categories']); toast.success('Tipe diperbarui') },
    onError:    e  => toast.error(e.response?.data?.message || 'Gagal memperbarui'),
  })
  const delCat = useMutation({
    mutationFn: id => categoriesApi.remove(id),
    onSuccess:  () => { qc.invalidateQueries(['categories']); toast.success('Tipe dihapus') },
    onError:    e  => toast.error(e.response?.data?.message || 'Gagal menghapus — mungkin masih dipakai produk'),
  })

  // ── Articles ───────────────────────────────────────────────────────────────
  const { data: artData, isLoading: artLoading } = useQuery({
    queryKey: ['articles', { page: artPage, name: artSearch }],
    queryFn:  () => articlesApi.list({ page: artPage, limit: 8, name: artSearch || undefined }),
  })

  const addArt = useMutation({
    mutationFn: name => articlesApi.create({ name }),
    onSuccess:  () => { qc.invalidateQueries(['articles']); toast.success('Koleksi ditambahkan') },
    onError:    e  => toast.error(e.response?.data?.message || 'Gagal menambah koleksi'),
  })
  const saveArt = useMutation({
    mutationFn: ([id, name]) => articlesApi.update(id, { name }),
    onSuccess:  () => { qc.invalidateQueries(['articles']); toast.success('Koleksi diperbarui') },
    onError:    e  => toast.error(e.response?.data?.message || 'Gagal memperbarui'),
  })
  const delArt = useMutation({
    mutationFn: id => articlesApi.remove(id),
    onSuccess:  () => { qc.invalidateQueries(['articles']); toast.success('Koleksi dihapus') },
    onError:    e  => toast.error(e.response?.data?.message || 'Gagal menghapus — mungkin masih dipakai produk'),
  })

  const confirmDelete = (mutate) => (id, name) => {
    if (confirm(`Hapus "${name}"? Produk yang menggunakan ini akan kehilangan referensinya.`)) {
      mutate(id)
    }
  }

  return (
    <div className="px-6 py-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-800">Katalog dan Koleksi</h2>
        <p className="text-sm text-slate-400 mt-0.5">Kelola tipe dan koleksi produk</p>
      </div>

      {blocked && (
        <div className="flex items-center gap-3 px-4 py-3.5 rounded-xl border border-amber-200 bg-amber-50 text-amber-800">
          <Building2 size={16} className="text-amber-500 flex-shrink-0" />
          <p className="text-sm font-medium">
            Pilih perusahaan di bagian atas terlebih dahulu untuk bisa menambah atau mengubah data katalog.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <CatalogTable
          title="Tipe"
          icon={Tag}
          data={catData?.data}
          pagination={catData?.pagination}
          isLoading={catLoading}
          placeholder="Nama tipe baru…"
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
    </div>
  )
}
