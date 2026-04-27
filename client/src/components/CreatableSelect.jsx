import { useState, useRef, useEffect } from 'react'
import { Plus, Check, X, ChevronDown, Loader2 } from 'lucide-react'

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
  const [open, setOpen]       = useState(false)
  const [creating, setCreating] = useState(false) // mode inline-create
  const [newName, setNewName] = useState('')
  const [saving, setSaving]   = useState(false)
  const inputRef = useRef(null)
  const wrapRef  = useRef(null)

  const selected = options.find(o => String(o.id) === String(value))

  // Tutup dropdown kalau klik di luar
  useEffect(() => {
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false)
        setCreating(false)
        setNewName('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Focus input saat masuk mode create
  useEffect(() => {
    if (creating) inputRef.current?.focus()
  }, [creating])

  const handleSelect = (id) => {
    onChange(id)
    setOpen(false)
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
        onClick={() => { setOpen(v => !v); setCreating(false) }}
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

          {/* List opsi yang ada */}
          <div className="max-h-48 overflow-y-auto">
            {options.length === 0 && (
              <p className="px-3 py-2 text-xs text-slate-400">Belum ada data</p>
            )}
            {options.map(o => (
              <button
                key={o.id}
                type="button"
                onClick={() => handleSelect(o.id)}
                className="w-full flex items-center justify-between px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <span>{o.name}</span>
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
