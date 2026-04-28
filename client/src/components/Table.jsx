import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'

const BRAND = '#C8102E'

export function Table({ columns, data, loading, emptyText = 'No data found' }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.key} className="th" style={col.width ? { width: col.width } : {}}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={columns.length} className="td text-center py-16">
                <Loader2 size={20} className="animate-spin mx-auto text-slate-300" />
              </td>
            </tr>
          ) : !data?.length ? (
            <tr>
              <td colSpan={columns.length} className="td text-center py-16 text-slate-400">
                <div className="flex flex-col items-center gap-1">
                  <div className="text-slate-200 text-3xl mb-1">—</div>
                  <span className="text-sm">{emptyText}</span>
                </div>
              </td>
            </tr>
          ) : data.map((row, i) => (
            <tr key={row.id ?? i} className="tr">
              {columns.map((col) => (
                <td key={col.key} className="td">
                  {col.render ? col.render(row) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function Pagination({ pagination, onPageChange }) {
  if (!pagination || !pagination.total) return null
  const { page = 1, totalPages = 1, total, limit = 10 } = pagination
  const from = (page - 1) * limit + 1
  const to   = Math.min(page * limit, total)

  const pages = []
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= page - 1 && i <= page + 1)) pages.push(i)
    else if (pages[pages.length - 1] !== '...') pages.push('...')
  }

  return (
    <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 bg-slate-50/50">
      <span className="text-xs text-slate-400 font-medium">
        Showing <span className="text-slate-600 font-semibold">{from}–{to}</span> of <span className="text-slate-600 font-semibold">{total}</span> results
      </span>
      {totalPages > 1 && (
        <div className="flex items-center gap-1">
          <button
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            className="w-8 h-8 rounded flex items-center justify-center text-slate-500 hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft size={14} />
          </button>
          {pages.map((p, i) =>
            p === '...' ? (
              <span key={`e-${i}`} className="w-8 h-8 flex items-center justify-center text-slate-400 text-xs">…</span>
            ) : (
              <button
                key={p}
                onClick={() => onPageChange(p)}
                className="w-8 h-8 rounded text-xs font-semibold transition-colors"
                style={p === page
                  ? { background: BRAND, color: '#fff' }
                  : { color: '#64748B' }
                }
                onMouseEnter={e => { if (p !== page) e.currentTarget.style.background = '#F1F5F9' }}
                onMouseLeave={e => { if (p !== page) e.currentTarget.style.background = '' }}
              >
                {p}
              </button>
            )
          )}
          <button
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            className="w-8 h-8 rounded flex items-center justify-center text-slate-500 hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  )
}
