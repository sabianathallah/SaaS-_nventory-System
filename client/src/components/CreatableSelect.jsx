import { useState, useRef, useEffect } from 'react'
import { Plus, Check, X, ChevronDown, Loader2, Search } from 'lucide-react'

/**
 * Dropdown yang bisa:
 * - Pilih item yang sudah ada
 * - Klik "+ Add New" → inline input → create langsung tanpa keluar dari modal
 *
 * Props:
 *   label        — label di atas dropdown
 *   value        — id terpilih (string / number)
 *   onChange     — fn(id) dipanggil saat pilih
 *   options      — [{ id, name }]
 *   placeholder  — teks saat belum ada pilihan
 *   onCreateNew  — async fn(name) → harus return { id, name } item baru
 *   required     — boolean
 *   createLabel  — teks tombol "Add New …" (default: "Add New")
 */
export default function CreatableSelect({
  label,
  value,
  onChange,
  options = [],
  placeholder = 'Pilih…',
  onCreateNew,
  required = false,
  createLabel = 'Add New',
  error = false,
}) {
  const [open, setOpen]         = useState(false)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName]   = useState('')
  const [saving, setSaving]     = useState(false)
  const [search, setSearch]     = useState('')
  const inputRef  = useRef(null)
  const searchRef = useRef(null)
  const wrapRef   = useRef(null)

  const selected = options.find(o => String(o.id) === String(value))

  // Tutup dropdown kalau klik di luar
  useEffect(() => {
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false)
        setCreating(false)
        setNewName('')
        setSearch('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Focus search saat dropdown buka, focus create-input saat mode create
  useEffect(() => {
    if (open && !creating) searchRef.current?.focus()
  }, [open, creating])

  useEffect(() => {
    if (creating) inputRef.current?.focus()
  }, [creating])

  const filtered = search.trim()
    ? options.filter(o => o.name.toLowerCase().includes(search.trim().toLowerCase()))
    : options

  const handleSelect = (id) => {
    onChange(id)
    setOpen(false)
    setSearch('')
  }

  const handleCreate = async () => {
    const trimmed = newName.trim()
    if (!trimmed) return
    setSaving(true)
    try {
      const created = await onCreateNew(trimmed)
      onChange(created.id)
      setCreating(false)
      setNewName('')
      setOpen(false)
    } finally {
      setSaving(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); handleCreate() }
    if (e.key === 'Escape') { setCreating(false); setNewName('') }
  }

  return (
    <div ref={wrapRef} className="relative">
      {label && (
        <label className="label">
          {label}
          {required && <span className="text-red-400 ml-0.5">*</span>}
        </label>
      )}

      {/* Trigger */}
      <button
        type="button"
        onClick={() => { setOpen(v => !v); setCreating(false); setSearch('') }}
        className={`select w-full flex items-center justify-between text-left transition-all ${
          error ? 'border-red-400 bg-red-50/30 focus:border-red-500' : ''
        }`}
      >
        <span className={selected ? 'text-slate-800' : 'text-slate-400'}>
          {selected ? selected.name : placeholder}
        </span>
        <ChevronDown size={14} className={`text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {error && (
        <p className="text-xs text-red-500 mt-1">Wajib diisi</p>
      )}

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-slate-200 bg-white shadow-lg overflow-hidden">

          {/* Search input */}
          <div className="px-2 pt-2 pb-1 border-b border-slate-100">
            <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-md bg-slate-50 border border-slate-200 focus-within:border-brand/50 focus-within:bg-white transition-colors">
              <Search size={12} className="text-slate-400 flex-shrink-0" />
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={e => e.key === 'Escape' && setOpen(false)}
                placeholder="Cari…"
                className="flex-1 text-sm bg-transparent outline-none text-slate-700 placeholder-slate-400 min-w-0"
              />
              {search && (
                <button type="button" onClick={() => setSearch('')} className="text-slate-300 hover:text-slate-500">
                  <X size={11} />
                </button>
              )}
            </div>
          </div>

          {/* List opsi yang ada */}
          <div className="max-h-48 overflow-y-auto">
            {filtered.length === 0 && (
              <p className="px-3 py-2 text-xs text-slate-400">{search ? 'Tidak ditemukan' : 'Belum ada data'}</p>
            )}
            {filtered.map(o => (
              <button
                key={o.id}
                type="button"
                onClick={() => handleSelect(o.id)}
                className="w-full flex items-center justify-between px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <span className="text-left">{o.name}</span>
                {String(o.id) === String(value) && <Check size={13} className="text-brand flex-shrink-0" />}
              </button>
            ))}
          </div>

          {/* Divider */}
          {onCreateNew && (
            <div className="border-t border-slate-100">
              {creating ? (
                /* Inline create form */
                <div className="flex items-center gap-2 px-3 py-2">
                  <input
                    ref={inputRef}
                    type="text"
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={`Nama ${createLabel}…`}
                    className="flex-1 text-sm px-2 py-1 rounded border border-slate-300 focus:outline-none focus:border-brand/60"
                  />
                  <button
                    type="button"
                    onClick={handleCreate}
                    disabled={!newName.trim() || saving}
                    className="p-1.5 rounded bg-brand text-white hover:bg-brand/90 disabled:opacity-40 transition-colors"
                    title="Simpan"
                  >
                    {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setCreating(false); setNewName('') }}
                    className="p-1.5 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                    title="Batal"
                  >
                    <X size={13} />
                  </button>
                </div>
              ) : (
                /* Tombol "+ Add New" */
                <button
                  type="button"
                  onClick={() => setCreating(true)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium text-brand hover:bg-brand/5 transition-colors"
                >
                  <Plus size={13} /> {createLabel}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
