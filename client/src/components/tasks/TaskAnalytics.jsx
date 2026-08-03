import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { ChevronUp, ChevronDown } from 'lucide-react'
import { tasksApi } from '../../api'

const BRAND = '#C8102E'
const fmtNum = (n) => Number(n ?? 0).toLocaleString('id-ID')
const fmtMonth = (m) => {
  const [y, mo] = m.split('-')
  return new Date(Number(y), Number(mo) - 1, 1).toLocaleDateString('id-ID', { month: 'short', year: '2-digit' })
}

// eslint-disable-next-line no-unused-vars
function StatCard({ label, value, sub, accent = BRAND }) {
  return (
    <div className="card px-5 py-4">
      <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-1">{label}</p>
      <p className="text-2xl font-bold leading-none tabular-nums" style={{ color: accent }}>{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </div>
  )
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg px-3 py-2 text-xs">
      <p className="font-semibold text-slate-600 mb-0.5">{label}</p>
      <p className="font-bold text-slate-800">{fmtNum(payload[0].value)} task selesai</p>
    </div>
  )
}

const STAFF_COLUMNS = [
  { key: 'name',             label: 'Nama' },
  { key: 'divisi',           label: 'Divisi' },
  { key: 'active',           label: 'Aktif' },
  { key: 'completed',        label: 'Selesai' },
  { key: 'overdue',          label: 'Overdue' },
  { key: 'rejected',         label: 'Ditolak' },
  { key: 'avgResponseHours', label: 'Avg Respon' },
]

export default function TaskAnalytics() {
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [sortBy, setSortBy] = useState('completed')
  const [sortDir, setSortDir] = useState('desc')

  const params = useMemo(() => ({
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  }), [dateFrom, dateTo])

  const { data, isLoading } = useQuery({
    queryKey: ['task-analytics', params],
    queryFn: () => tasksApi.analytics(params),
  })

  const byStaff = data?.byStaff ?? []
  const byDivisi = data?.byDivisi ?? []
  const monthlyTrend = data?.monthlyTrend ?? []

  const totals = useMemo(() => ({
    completed: byStaff.reduce((s, r) => s + Number(r.completed), 0),
    overdue: byStaff.reduce((s, r) => s + Number(r.overdue), 0),
    avgResponseHours: (() => {
      const withResponse = byStaff.filter(r => r.avgResponseHours !== null)
      if (!withResponse.length) return null
      return Math.round(withResponse.reduce((s, r) => s + Number(r.avgResponseHours), 0) / withResponse.length)
    })(),
  }), [byStaff])

  const sortedStaff = useMemo(() => {
    const rows = [...byStaff]
    rows.sort((a, b) => {
      const av = a[sortBy] ?? 0, bv = b[sortBy] ?? 0
      if (typeof av === 'string') return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
      return sortDir === 'asc' ? av - bv : bv - av
    })
    return rows
  }, [byStaff, sortBy, sortDir])

  function toggleSort(key) {
    if (sortBy === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortBy(key); setSortDir('desc') }
  }

  const maxDivisiRate = Math.max(...byDivisi.map(d => d.completionRate), 1)

  if (isLoading) {
    return <p className="text-sm text-slate-400 text-center py-16">Memuat…</p>
  }

  return (
    <div className="p-4 space-y-5">
      {/* Filter tanggal */}
      <div className="card p-4 flex items-end gap-3 flex-wrap">
        <div>
          <label className="block text-[11px] font-medium text-slate-500 mb-1">Dari Tanggal</label>
          <input type="date" className="input py-1.5 text-sm" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
        </div>
        <div>
          <label className="block text-[11px] font-medium text-slate-500 mb-1">Sampai Tanggal</label>
          <input type="date" className="input py-1.5 text-sm" value={dateTo} onChange={e => setDateTo(e.target.value)} />
        </div>
        {(dateFrom || dateTo) && (
          <button onClick={() => { setDateFrom(''); setDateTo('') }} className="btn-secondary py-1.5 px-3 text-xs">Reset</button>
        )}
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Task Selesai" value={fmtNum(totals.completed)} sub="berdasarkan filter tanggal" accent="#16A34A" />
        <StatCard label="Overdue Aktif" value={fmtNum(totals.overdue)} sub="belum selesai, lewat due date" accent="#DC2626" />
        <StatCard
          label="Rata-rata Respon Assignment"
          value={totals.avgResponseHours !== null ? `${fmtNum(totals.avgResponseHours)} jam` : '—'}
          sub="waktu accept/reject setelah ditugaskan"
          accent="#2563EB"
        />
      </div>

      {/* Tren bulanan */}
      <div className="card px-5 py-4">
        <p className="text-sm font-bold text-slate-700 mb-3">Tren Task Selesai per Bulan</p>
        {monthlyTrend.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-8">Belum ada task selesai di rentang ini</p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={monthlyTrend.map(r => ({ ...r, label: fmtMonth(r.month) }))} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={{ stroke: '#E2E8F0' }} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: '#F8FAFC' }} />
              <Bar dataKey="completed" radius={[4, 4, 0, 0]} barSize={32} fill={BRAND} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Performa per divisi */}
      <div className="card px-5 py-4">
        <p className="text-sm font-bold text-slate-700 mb-3">Performa per Divisi</p>
        {byDivisi.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-8">Belum ada data</p>
        ) : (
          <div className="space-y-2.5">
            {byDivisi.map(d => (
              <div key={d.divisi}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-slate-600">{d.divisi}</span>
                  <span className="text-xs text-slate-400">
                    <span className="font-bold text-slate-700">{d.completionRate}%</span> selesai · {fmtNum(d.completed)}/{fmtNum(d.total)} task
                    {d.overdue > 0 && <span className="text-danger font-medium"> · {d.overdue} overdue</span>}
                  </span>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${(d.completionRate / maxDivisiRate) * 100}%`, background: BRAND }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Leaderboard per staff */}
      <div className="border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              {STAFF_COLUMNS.map(col => (
                <th
                  key={col.key}
                  onClick={() => toggleSort(col.key)}
                  className="text-left px-3 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wide cursor-pointer hover:text-slate-700 select-none"
                >
                  <span className="inline-flex items-center gap-1">
                    {col.label}
                    {sortBy === col.key && (sortDir === 'asc' ? <ChevronUp size={11} /> : <ChevronDown size={11} />)}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedStaff.length === 0 ? (
              <tr><td colSpan={STAFF_COLUMNS.length} className="text-center text-sm text-slate-400 py-10">Belum ada data staff</td></tr>
            ) : sortedStaff.map(s => (
              <tr key={s.userId} className="border-b border-slate-100 hover:bg-slate-50/60 transition-colors">
                <td className="px-3 py-2 font-medium text-slate-800">{s.name}</td>
                <td className="px-3 py-2 text-slate-500">{s.divisi || '—'}</td>
                <td className="px-3 py-2 tabular-nums">{fmtNum(s.active)}</td>
                <td className="px-3 py-2 tabular-nums text-success font-semibold">{fmtNum(s.completed)}</td>
                <td className={`px-3 py-2 tabular-nums font-semibold ${Number(s.overdue) > 0 ? 'text-danger' : 'text-slate-400'}`}>{fmtNum(s.overdue)}</td>
                <td className={`px-3 py-2 tabular-nums ${Number(s.rejected) > 0 ? 'text-warning font-semibold' : 'text-slate-400'}`}>{fmtNum(s.rejected)}</td>
                <td className="px-3 py-2 tabular-nums text-slate-500">{s.avgResponseHours !== null ? `${fmtNum(s.avgResponseHours)} jam` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
