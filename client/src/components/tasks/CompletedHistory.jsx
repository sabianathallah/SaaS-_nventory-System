import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronDown, CheckCircle2 } from 'lucide-react'
import { tasksApi } from '../../api'

const MONTH_LABEL = (key) => {
  const [y, m] = key.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
}

function mondayOf(date) {
  const d = new Date(date)
  const day = d.getDay() // 0 Sun .. 6 Sat
  const diff = (day === 0 ? -6 : 1) - day
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

const fmtShort = (d) => d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })

// Groups completed tasks Bulan → Minggu (nested accordion), paling baru di
// atas — dipakai di Dashboard sebagai "riwayat" begitu tugas di My Day
// dicentang selesai, biar histori harian tidak cuma jadi daftar rata.
function groupCompleted(tasks) {
  const months = new Map()
  for (const t of tasks) {
    const completedAt = t.completedAt || t.updatedAt
    if (!completedAt) continue
    const d = new Date(completedAt)
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const monday = mondayOf(d)
    const weekKey = monday.toISOString().slice(0, 10)

    if (!months.has(monthKey)) months.set(monthKey, { key: monthKey, weeks: new Map() })
    const month = months.get(monthKey)
    if (!month.weeks.has(weekKey)) {
      const sunday = new Date(monday)
      sunday.setDate(sunday.getDate() + 6)
      month.weeks.set(weekKey, { key: weekKey, start: monday, end: sunday, tasks: [] })
    }
    month.weeks.get(weekKey).tasks.push(t)
  }

  return [...months.values()]
    .sort((a, b) => b.key.localeCompare(a.key))
    .map(month => ({
      ...month,
      count: [...month.weeks.values()].reduce((s, w) => s + w.tasks.length, 0),
      weeks: [...month.weeks.values()]
        .sort((a, b) => b.key.localeCompare(a.key))
        .map(w => ({ ...w, tasks: w.tasks.sort((a, b) => new Date(b.completedAt || b.updatedAt) - new Date(a.completedAt || a.updatedAt)) })),
    }))
}

function WeekGroup({ week }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border border-slate-100 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-3 py-2 bg-slate-50/60 hover:bg-slate-100/70 transition-colors"
      >
        <span className="text-xs font-semibold text-slate-600">
          Minggu {fmtShort(week.start)} – {fmtShort(week.end)}
        </span>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-slate-400 bg-white border border-slate-200 px-1.5 rounded-full">{week.tasks.length}</span>
          <ChevronDown size={12} className={`text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
        </div>
      </button>
      {open && (
        <div className="divide-y divide-slate-50">
          {week.tasks.map(t => (
            <div key={t.id} className="flex items-center gap-2.5 px-3 py-2">
              <CheckCircle2 size={14} className="text-success flex-shrink-0" />
              <span className="text-sm text-slate-500 line-through truncate flex-1">{t.title}</span>
              <span className="text-[10px] text-slate-400 flex-shrink-0">
                {new Date(t.completedAt || t.updatedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function MonthGroup({ month, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-1 py-2"
      >
        <span className="text-sm font-bold text-slate-700 capitalize">{MONTH_LABEL(month.key)}</span>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 rounded-full">{month.count} selesai</span>
          <ChevronDown size={13} className={`text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
        </div>
      </button>
      {open && (
        <div className="space-y-1.5 pb-2">
          {month.weeks.map(w => <WeekGroup key={w.key} week={w} />)}
        </div>
      )}
    </div>
  )
}

export default function CompletedHistory() {
  const params = { view: 'completed', mine: 'true', limit: 300 }
  const { data, isLoading } = useQuery({
    queryKey: ['tasks', params],
    queryFn: () => tasksApi.list(params),
  })
  const grouped = useMemo(() => groupCompleted(data?.data ?? []), [data])

  return (
    <div className="card p-5">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-success-light">
          <CheckCircle2 size={18} className="text-success" />
        </div>
        <div>
          <p className="text-sm font-bold text-slate-800">Riwayat Selesai</p>
          <p className="text-xs text-slate-400">Dikelompokkan per minggu &amp; bulan</p>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2].map(i => <div key={i} className="h-9 bg-slate-100 rounded-lg animate-pulse" />)}
        </div>
      ) : grouped.length === 0 ? (
        <p className="text-sm text-slate-300 text-center py-8">Belum ada tugas yang selesai</p>
      ) : (
        <div className="space-y-1 divide-y divide-slate-50">
          {grouped.map((month, i) => (
            <div key={month.key} className={i > 0 ? 'pt-1' : ''}>
              <MonthGroup month={month} defaultOpen={i === 0} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
