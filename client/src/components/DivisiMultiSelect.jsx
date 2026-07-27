import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Search, Check, X, Plus } from 'lucide-react'

// Multi-select for divisi: pick from existing divisions (dropdown, no
// typo-prone free text) with an inline "+ Tambah divisi baru" option when
// the search doesn't match anything yet — same open/search/click-outside
// shell as AssigneeMultiSelect/SearchableSelect, adapted for plain strings.
export default function DivisiMultiSelect({ value, onChange, options = [], placeholder = 'Pilih divisi…', className = '' }) {
  const [open, setOpen]     = useState(false)
  const [search, setSearch] = useState('')
  const ref                 = useRef(null)
  const inputRef            = useRef(null)

  const selected = value ?? []
  const normalizedSearch = search.trim().toLowerCase()
  const filtered = normalizedSearch
    ? options.filter(d => d.toLowerCase().includes(normalizedSearch))
    : options
  const exactMatch = options.some(d => d.toLowerCase() === normalizedSearch)
  const canCreate = normalizedSearch && !exactMatch

  useEffect(() => {
    if (!open) return
    const handler = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus()
  }, [open])

  function toggle(divisi) {
    const next = selected.includes(divisi) ? selected.filter(d => d !== divisi) : [...selected, divisi]
    onChange(next)
  }

  function createAndSelect() {
    const name = search.trim()
    if (!name || selected.includes(name)) return
    onChange([...selected, name])
    setSearch('')
  }

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => { setOpen(v => !v); setSearch('') }}
        className="select w-full flex items-center justify-between gap-2 text-left min-h-[38px]"
      >
        {selected.length ? (
          <span className="flex flex-wrap items-center gap-1 flex-1 py-0.5">
            {selected.map(d => (
              <span
                key={d}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-white bg-slate-700 px-1.5 py-0.5 rounded-full"
              >
                {d}
                <span
                  role="button"
                  tabIndex={-1}
                  onClick={e => { e.stopPropagation(); toggle(d) }}
                  className="hover:opacity-70"
                >
                  <X size={10} />
                </span>
              </span>
            ))}
          </span>
        ) : (
          <span className="truncate flex-1 text-slate-400">{placeholder}</span>
        )}
        <ChevronDown size={13} className={`flex-shrink-0 text-slate-400 transition-transform duration-150 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
          <div className="p-2 border-b border-slate-100">
            <div className="relative">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                ref={inputRef}
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && canCreate) { e.preventDefault(); createAndSelect() } }}
                placeholder="Cari atau ketik nama divisi baru…"
                className="w-full pl-7 pr-3 py-1.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-red-400 focus:bg-white transition-all"
              />
            </div>
          </div>
          <ul className="max-h-52 overflow-y-auto py-1">
            {filtered.length === 0 && !canCreate ? (
              <li className="px-3 py-2 text-sm text-slate-400 italic">Tidak ditemukan</li>
            ) : (
              filtered.map(d => {
                const isSelected = selected.includes(d)
                return (
                  <li
                    key={d}
                    onClick={() => toggle(d)}
                    className={`flex items-center gap-2 px-3 py-2 text-sm cursor-pointer transition-colors ${
                      isSelected ? 'bg-red-50 text-red-700 font-semibold' : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${isSelected ? 'bg-red-600 border-red-600' : 'border-slate-300'}`}>
                      {isSelected && <Check size={10} className="text-white" strokeWidth={3.5} />}
                    </span>
                    {d}
                  </li>
                )
              })
            )}
            {canCreate && (
              <li
                onClick={createAndSelect}
                className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer text-red-700 font-semibold hover:bg-red-50 border-t border-slate-100"
              >
                <Plus size={13} />
                Tambah divisi baru: "{search.trim()}"
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  )
}
