import { useMemo, useState } from 'react'
import { Search, SearchX, ChevronDown, Calendar } from 'lucide-react'
import {
  allPolicies, getCategories, categoryIcons, getCategoryColor,
  countByCategory, filterPolicies, renderContent, SEARCH_PLACEHOLDER,
} from './data'

function PolicyCard({ policy, isExpanded, onToggle }) {
  const color = getCategoryColor(policy.category)
  return (
    <div
      className="card overflow-hidden cursor-pointer transition-shadow hover:shadow-card-md"
      onClick={onToggle}
    >
      <div className="flex items-start justify-between gap-3 px-4 py-3.5">
        <div className="min-w-0">
          <p className="text-sm font-bold text-slate-800">{policy.title}</p>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">{policy.summary}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span
            className="text-[11px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap"
            style={{ color, borderColor: `${color}33`, background: `${color}14` }}
          >
            {policy.category}
          </span>
          <ChevronDown
            size={16}
            className={`text-slate-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
          />
        </div>
      </div>

      {isExpanded && (
        <div className="px-4 pb-4 pt-1 border-t border-slate-100" onClick={e => e.stopPropagation()}>
          <div className="text-sm text-slate-600 leading-relaxed space-y-2">
            {renderContent(policy.content)}
          </div>
          <div className="flex flex-wrap items-center gap-1.5 mt-4 pt-3 border-t border-slate-100">
            {policy.tags.map(t => (
              <span key={t} className="text-[11px] font-medium text-slate-400 bg-slate-100 rounded px-1.5 py-0.5">#{t}</span>
            ))}
            <span className="ml-auto flex items-center gap-1 text-[11px] text-slate-400">
              <Calendar size={11} /> Diperbarui {policy.lastUpdated}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

export default function HandbookPolicies() {
  const [activeCategory, setActiveCategory] = useState('Semua')
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedId, setExpandedId] = useState(null)

  const categories = useMemo(() => getCategories(), [])

  const filteredPolicies = useMemo(
    () => filterPolicies(allPolicies, activeCategory, searchQuery),
    [activeCategory, searchQuery]
  )

  const categoryCounts = useMemo(() => {
    const counts = countByCategory(allPolicies)
    counts['Semua'] = allPolicies.length
    return counts
  }, [])

  return (
    <div className="max-w-5xl mx-auto px-6 py-6 space-y-5">
      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder={SEARCH_PLACEHOLDER}
          className="input pl-9"
        />
      </div>

      {/* Category filter chips */}
      <div className="flex flex-wrap gap-2">
        {categories.map(cat => {
          const Icon = categoryIcons[cat]
          const isActive = activeCategory === cat
          return (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveCategory(cat)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                isActive
                  ? 'bg-brand text-white border-brand'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-brand/40 hover:text-brand'
              }`}
            >
              {Icon && <Icon size={13} />}
              {cat}
              <span className={`px-1.5 rounded-full text-[10px] ${isActive ? 'bg-white/20' : 'bg-slate-100'}`}>
                {categoryCounts[cat] ?? 0}
              </span>
            </button>
          )
        })}
      </div>

      {/* Policy list */}
      {filteredPolicies.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-14 text-center">
          <SearchX size={32} className="text-slate-300 mb-3" />
          <p className="text-sm font-semibold text-slate-500">Kebijakan tidak ditemukan</p>
          <p className="text-xs text-slate-400 mt-1">Coba ubah kata kunci pencarian atau kategori.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredPolicies.map(policy => (
            <PolicyCard
              key={policy.id}
              policy={policy}
              isExpanded={expandedId === policy.id}
              onToggle={() => setExpandedId(expandedId === policy.id ? null : policy.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
