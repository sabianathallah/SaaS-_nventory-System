import { useState, useRef, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { companiesApi } from '../api'
import { useSelectedCompany } from '../context/SelectedCompanyContext'
import { useAuth } from '../context/AuthContext'
import { Building2, ChevronDown, Check, Globe } from 'lucide-react'

const BRAND = '#C8102E'

export default function CompanySwitcher() {
  const { isSuperAdmin } = useAuth()
  const { selectedCompany, setSelectedCompany } = useSelectedCompany()
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  const { data } = useQuery({
    queryKey: ['companies-list'],
    queryFn:  () => companiesApi.list({ limit: 100 }),
    enabled:  isSuperAdmin,
    staleTime: 60_000,
  })

  const companies = data?.data ?? []

  // Close on outside click
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  if (!isSuperAdmin) return null

  const handleSelect = (company) => {
    setSelectedCompany(company)
    qc.invalidateQueries()
    setOpen(false)
  }

  const isAll = !selectedCompany

  return (
    <div ref={ref} className="relative flex-shrink-0">
      <button
        onClick={() => setOpen(v => !v)}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${
          isAll
            ? 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
            : 'border-brand/30 text-brand hover:bg-brand/5'
        }`}
        style={!isAll ? { background: `${BRAND}08` } : {}}
      >
        {isAll
          ? <Globe size={12} className="text-slate-400" />
          : <Building2 size={12} style={{ color: BRAND }} />}
        <span className="max-w-[120px] truncate">
          {isAll ? 'Semua Perusahaan' : selectedCompany.name}
        </span>
        <ChevronDown size={11} className={`transition-transform ${open ? 'rotate-180' : ''} ${isAll ? 'text-slate-400' : 'text-brand/60'}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-52 bg-white rounded-xl border border-slate-200 shadow-lg z-50 overflow-hidden animate-fade-in">
          {/* All companies option */}
          <button
            onClick={() => handleSelect(null)}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs text-left hover:bg-slate-50 transition-colors border-b border-slate-100"
          >
            <div className="w-6 h-6 rounded-md bg-slate-100 flex items-center justify-center flex-shrink-0">
              <Globe size={12} className="text-slate-400" />
            </div>
            <span className="flex-1 font-semibold text-slate-700">Semua Perusahaan</span>
            {isAll && <Check size={12} style={{ color: BRAND }} />}
          </button>

          {/* Company list */}
          <div className="max-h-52 overflow-y-auto py-1">
            {companies.length === 0 ? (
              <p className="px-3 py-3 text-xs text-slate-400 text-center">Tidak ada perusahaan</p>
            ) : companies.map(c => {
              const isSelected = selectedCompany?.id === c.id
              return (
                <button
                  key={c.id}
                  onClick={() => handleSelect({ id: c.id, name: c.name })}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-left hover:bg-slate-50 transition-colors"
                >
                  <div
                    className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 text-[10px] font-bold text-white flex-shrink-0"
                    style={{ background: isSelected ? BRAND : '#94A3B8' }}
                  >
                    {c.name[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-700 truncate">{c.name}</p>
                    {c.status && (
                      <p className={`text-[10px] ${c.status === 'active' ? 'text-emerald-500' : 'text-slate-400'}`}>
                        {c.status}
                      </p>
                    )}
                  </div>
                  {isSelected && <Check size={12} style={{ color: BRAND }} />}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
