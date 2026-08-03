import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Search, Check, X } from 'lucide-react'
import { avatarColor, initials } from './taskConfig'

// Same open/search/click-outside behavior as SearchableSelect, but toggles
// membership in an array of ids instead of picking a single value.
export default function AssigneeMultiSelect({ value, onChange, options = [], placeholder = 'Tidak ditugaskan', className = '' }) {
  const [open, setOpen]     = useState(false)
  const [search, setSearch] = useState('')
  const ref                 = useRef(null)
  const inputRef            = useRef(null)

  const ids = (value ?? []).map(String)
  const selectedUsers = options.filter(u => ids.includes(String(u.id)))
  const filtered = search
    ? options.filter(u => u.name.toLowerCase().includes(search.toLowerCase()))
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

  function toggle(userId) {
    const idStr = String(userId)
    const next = ids.includes(idStr) ? ids.filter(id => id !== idStr) : [...ids, idStr]
    onChange(next)
  }

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => { setOpen(v => !v); setSearch('') }}
        className="select w-full flex items-center justify-between gap-2 text-left min-h-[38px]"
      >
        {selectedUsers.length ? (
          <span className="flex flex-wrap items-center gap-1 flex-1 py-0.5">
            {selectedUsers.map(u => (
              <span
                key={u.id}
                className={`inline-flex items-center gap-1 text-[11px] font-semibold text-white px-1.5 py-0.5 rounded-full ${avatarColor(u.id)}`}
              >
                {u.name}
                <span
                  role="button"
                  tabIndex={-1}
                  onClick={e => { e.stopPropagation(); toggle(u.id) }}
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
                placeholder="Cari nama…"
                className="w-full pl-7 pr-3 py-1.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-red-400 focus:bg-white transition-all"
              />
            </div>
          </div>
          <ul className="max-h-52 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-sm text-slate-400 italic">Tidak ditemukan</li>
            ) : (
              filtered.map(u => {
                const isSelected = ids.includes(String(u.id))
                return (
                  <li
                    key={u.id}
                    onClick={() => toggle(u.id)}
                    className={`flex items-center gap-2 px-3 py-2 text-sm cursor-pointer transition-colors ${
                      isSelected ? 'bg-red-50 text-red-700 font-semibold' : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${isSelected ? 'bg-red-600 border-red-600' : 'border-slate-300'}`}>
                      {isSelected && <Check size={10} className="text-white" strokeWidth={3.5} />}
                    </span>
                    <span className={`w-5 h-5 rounded-full text-white text-[9px] font-bold flex items-center justify-center flex-shrink-0 ${avatarColor(u.id)}`}>
                      {initials(u.name)}
                    </span>
                    {u.name}
                  </li>
                )
              })
            )}
          </ul>
        </div>
      )}
    </div>
  )
}
