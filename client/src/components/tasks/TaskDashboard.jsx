import { useQuery } from '@tanstack/react-query'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid } from 'recharts'
import { ListTodo, AlarmClock, CalendarClock, CheckCircle2, ClipboardList } from 'lucide-react'
import { tasksApi } from '../../api'
import MyDayToday from './MyDayToday'

// Literal hex values (recharts fill/stroke can't take Tailwind classes) mapped
// 1:1 from tailwind.config.js's semantic tokens, so these charts read as the
// same "language" as the STATUS_CONFIG/PRIORITY_CONFIG badges everywhere else
// in this module — not a copy of Dashboard.jsx's own ad-hoc PALETTE array.
const BRAND = '#C8102E'
const STATUS_COLORS = { TODO: '#94A3B8', IN_PROGRESS: '#2563EB', DONE: '#16A34A' }
const STATUS_LABELS = { TODO: 'To Do', IN_PROGRESS: 'In Progress', DONE: 'Done' }
const PRIORITY_COLORS = { LOW: '#CBD5E1', MEDIUM: '#D97706', HIGH: '#DC2626' }
const PRIORITY_LABELS = { LOW: 'Low', MEDIUM: 'Medium', HIGH: 'High' }

const fmtNum = (n) => Number(n ?? 0).toLocaleString('id-ID')

// `Icon` is used in JSX below; this project's eslint config has no
// react/jsx-uses-vars rule (same false positive already exists in
// Dashboard.jsx's identical StatCard pattern).
// eslint-disable-next-line no-unused-vars
function StatCard({ label, value, sub, icon: Icon, accent = BRAND }) {
  return (
    <div className="card px-5 py-4 flex items-start gap-4">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: accent + '18' }}>
        <Icon size={18} style={{ color: accent }} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-1">{label}</p>
        <p className="text-2xl font-bold text-slate-800 leading-none tabular-nums">{value}</p>
        {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
      </div>
    </div>
  )
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg px-3 py-2 text-xs">
      <p className="font-semibold text-slate-600 mb-0.5">{label}</p>
      <p className="font-bold text-slate-800">{fmtNum(payload[0].value)} task</p>
    </div>
  )
}

function MiniBarChart({ title, data, colors, labels }) {
  const chartData = Object.entries(data ?? {}).map(([key, value]) => ({ key, label: labels[key] ?? key, value }))
  return (
    <div className="card px-5 py-4">
      <p className="text-sm font-bold text-slate-700 mb-3">{title}</p>
      <ResponsiveContainer width="100%" height={160}>
        <BarChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={{ stroke: '#E2E8F0' }} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} allowDecimals={false} />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: '#F8FAFC' }} />
          <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={40}>
            {chartData.map((d) => <Cell key={d.key} fill={colors[d.key] ?? '#CBD5E1'} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export default function TaskDashboard() {
  const { data: stats, isLoading } = useQuery({ queryKey: ['task-stats'], queryFn: tasksApi.stats })

  if (isLoading) {
    return <p className="text-sm text-slate-400 text-center py-16">Memuat…</p>
  }

  return (
    <div className="p-4 space-y-5">
      {/* My Day — komponen yang persis sama dengan yang ada di Personal
          Dashboard (/home), cuma dirender ulang di sini biar orang yang lagi
          kerja di dalam modul Tugas tidak perlu bolak-balik ke Home buat
          lihat/centang tugas hari ini. Satu sumber data (queryKey ['tasks',...]
          sama), bukan implementasi kedua yang terpisah. */}
      <div>
        <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-2 px-0.5">My Day</p>
        <MyDayToday />
      </div>

      <div>
        <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-2 px-0.5">Statistik</p>
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <StatCard label="Total Task" value={fmtNum(stats.total)} icon={ListTodo} />
            <StatCard label="Overdue" value={fmtNum(stats.overdue)} icon={AlarmClock} accent="#DC2626" />
            <StatCard label="Due Minggu Ini" value={fmtNum(stats.dueSoon)} icon={CalendarClock} accent="#D97706" />
            <StatCard label="Completion Rate" value={`${stats.completionRate}%`} icon={CheckCircle2} accent="#16A34A" />
            <StatCard label="Menunggu Respon Saya" value={fmtNum(stats.pendingAssignments)} icon={ClipboardList} accent="#2563EB" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <MiniBarChart title="Berdasarkan Status" data={stats.byStatus} colors={STATUS_COLORS} labels={STATUS_LABELS} />
            <MiniBarChart title="Berdasarkan Priority" data={stats.byPriority} colors={PRIORITY_COLORS} labels={PRIORITY_LABELS} />
          </div>

          {stats.byList?.length > 0 && (
            <div className="card px-5 py-4">
              <p className="text-sm font-bold text-slate-700 mb-3">Berdasarkan List</p>
              <div className="space-y-2.5">
                {stats.byList.map((l) => {
                  const max = Math.max(...stats.byList.map((x) => x.count), 1)
                  const pct = Math.round((l.count / max) * 100)
                  return (
                    <div key={l.id}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="flex items-center gap-2 text-sm font-medium text-slate-600">
                          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: l.color }} />
                          {l.name}
                        </span>
                        <span className="text-sm font-bold tabular-nums text-slate-800">{fmtNum(l.count)}</span>
                      </div>
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: l.color }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
