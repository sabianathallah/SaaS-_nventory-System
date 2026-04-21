const RED = '#C8102E'

export default function StatCard({ label, value, sub, icon: Icon, color = 'red' }) {
  const styles = {
    red:     { bg: '#FFF1F1', text: RED,       border: '#FECACA' },
    green:   { bg: '#DCFCE7', text: '#16A34A', border: '#BBF7D0' },
    blue:    { bg: '#DBEAFE', text: '#2563EB', border: '#BFDBFE' },
    muted:   { bg: '#F1F5F9', text: '#64748B', border: '#E2E8F0' },
  }
  const s = styles[color] ?? styles.red

  return (
    <div className="card p-5 hover:shadow-card-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</p>
        {Icon && (
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 border"
            style={{ background: s.bg, color: s.text, borderColor: s.border }}
          >
            <Icon size={15} strokeWidth={2} />
          </div>
        )}
      </div>
      <p className="text-2xl font-bold text-slate-800 font-mono tracking-tight">{value ?? '—'}</p>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </div>
  )
}
