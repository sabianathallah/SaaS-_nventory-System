const MEDAL = ['🥇', '🥈', '🥉']
const initials = (name = '') => name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()

// Card leaderboard kehadiran — avatar bisa diklik untuk dibuka lebih besar
// (lightbox dikelola di komponen pemanggil lewat onAvatarClick), dengan bar
// tipis di bawah nama buat kasih rasa "seberapa jauh" dibanding yang lain.
export default function LeaderboardCard({ icon: Icon, title, entries, unit, badgeClass, barClass, ringClass, fallbackClass, onAvatarClick, extra }) {
  if (!entries?.length) return null
  const max = Math.max(...entries.map(e => e.value))

  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 mb-3">
        <Icon size={16} />
        <p className="text-sm font-semibold text-slate-800">{title}</p>
      </div>
      <div className="space-y-3">
        {entries.map((e, i) => (
          <div key={e.userId} className="flex items-center gap-2.5">
            <span className="w-5 text-center text-xs font-bold text-slate-400 shrink-0">{MEDAL[i] ?? i + 1}</span>
            <button
              type="button"
              onClick={() => onAvatarClick({ name: e.name, avatar: e.avatar })}
              className="shrink-0 rounded-full hover:ring-2 hover:ring-offset-1 transition-all"
              title="Lihat foto"
            >
              {e.avatar ? (
                <img src={e.avatar} alt={e.name} className={`w-9 h-9 rounded-full object-cover border-2 ${ringClass}`} />
              ) : (
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold ${fallbackClass}`}>
                  {e.name ? initials(e.name) : '?'}
                </div>
              )}
            </button>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-700 truncate">{e.name}</p>
              <div className="h-1.5 rounded-full bg-slate-100 mt-1 overflow-hidden">
                <div className={`h-full rounded-full ${barClass}`} style={{ width: `${Math.max(6, (e.value / max) * 100)}%` }} />
              </div>
              {extra?.(e)}
            </div>
            <span className={`text-xs font-semibold rounded-full px-2 py-0.5 shrink-0 ${badgeClass}`}>{e.value}{unit}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
