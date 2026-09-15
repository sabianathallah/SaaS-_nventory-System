import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Search } from 'lucide-react'

export default function SearchableSelect({
  value,
  onChange,
  options = [],
  placeholder = 'Pilih…',
  className = '',
  required = false,
  disabled = false,
}) {
  const [open, setOpen]     = useState(false)
  const [search, setSearch] = useState('')
  const ref                 = useRef(null)
  const inputRef            = useRef(null)

  const selected = options.find(o => String(o.value) === String(value ?? ''))
  const filtered = search
    ? options.filter(o => o.label.toLowerCase().includes(search.toLowerCase()))
    : options

  useEffect(() => {
    if (!open) return
    const handler = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus()
  }, [open])

  const handleSelect = (val) => {
    onChange(val)
    setOpen(false)
    setSearch('')
  }

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => { setOpen(v => !v); setSearch('') }}
        className={`select w-full flex items-center justify-between gap-2 text-left ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${!selected || selected.value === '' ? 'text-slate-400' : 'text-slate-800'}`}
      >
        <span className="truncate flex-1">{selected && selected.value !== '' ? selected.label : placeholder}</span>
        <ChevronDown size={13} className={`flex-shrink-0 text-slate-400 transition-transform duration-150 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && !disabled && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
          <div className="p-2 border-b border-slate-100">
            <div className="relative">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                ref={inputRef}
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Cari…"
                className="w-full pl-7 pr-3 py-1.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-red-400 focus:bg-white transition-all"
              />
            </div>
          </div>
          <ul className="max-h-52 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-sm text-slate-400 italic">Tidak ditemukan</li>
            ) : (
              filtered.map(o => (
                <li
                  key={String(o.value)}
                  onClick={() => handleSelect(o.value)}
                  className={`px-3 py-2 text-sm cursor-pointer transition-colors ${
                    String(o.value) === String(value ?? '')
                      ? 'bg-red-50 text-red-700 font-semibold'
                      : o.value === '' ? 'text-slate-400 hover:bg-slate-50' : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {o.label}
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  )
}
