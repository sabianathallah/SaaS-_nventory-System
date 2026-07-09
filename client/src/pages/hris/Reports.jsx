import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { hrisApi } from '../../api'
import { exportExcel } from '../../utils/exportExcel'
import { FileDown } from 'lucide-react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell,
} from 'recharts'

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
const fmtDateShort = (d) => d ? new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }) : '—'
const STATUS_LABEL = { PRESENT: 'Hadir', LATE: 'Terlambat', ABSENT: 'Absen', LEAVE: 'Cuti', HALF_DAY: 'Setengah Hari' }
const STATUS_ORDER = ['PRESENT', 'LATE', 'HALF_DAY', 'LEAVE', 'ABSENT']
const STATUS_COLOR = { PRESENT: '#16A34A', LATE: '#D97706', ABSENT: '#DC2626', LEAVE: '#2563EB', HALF_DAY: '#DB2777' }
const WORKMODE_LABEL = { ON_SITE: 'Di Kantor', WFA: 'WFA', FIELD: 'Lapangan' }
const WORKMODE_COLOR = { ON_SITE: '#C8102E', WFA: '#2563EB', FIELD: '#0D9488' }
const SEVERITY_COLOR = { RINGAN: 'text-amber-600 bg-amber-50', SEDANG: 'text-orange-600 bg-orange-50', BERAT: 'text-red-600 bg-red-50' }

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-card-md px-3 py-2 text-xs">
      {label && <p className="font-semibold text-slate-700 mb-1">{label}</p>}
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-1.5 text-slate-600">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color || p.payload?.fill }} />
          <span>{p.name}: <span className="font-semibold text-slate-800">{p.value}</span></span>
        </div>
      ))}
    </div>
  )
}

export default function Reports() {
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [userFilter, setUserFilter] = useState('ALL')

  const { data, isLoading } = useQuery({
    queryKey: ['hris-report', dateFrom, dateTo],
    queryFn: () => hrisApi.attendanceReport({ ...(dateFrom && { dateFrom }), ...(dateTo && { dateTo }) }),
  })

  const employeeOptions = useMemo(() => {
    if (!data?.attendances?.length) return []
    const seen = new Map()
    data.attendances.forEach(a => { if (a.userId && a.user?.name && !seen.has(a.userId)) seen.set(a.userId, a.user.name) })
    return Array.from(seen, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name))
  }, [data])

  const filteredAttendances = useMemo(() => {
    return (data?.attendances ?? []).filter(a =>
      (statusFilter === 'ALL' || a.status === statusFilter) &&
      (userFilter === 'ALL' || a.userId === userFilter)
    )
  }, [data, statusFilter, userFilter])

  const lateRanking = useMemo(() => {
    if (!data?.attendances?.length) return []
    const counts = new Map()
    data.attendances.forEach(a => {
      if (a.status !== 'LATE' || !a.userId) return
      const key = a.userId
      const cur = counts.get(key) || { userId: key, name: a.user?.name ?? '—', count: 0 }
      cur.count += 1
      counts.set(key, cur)
    })
    return Array.from(counts.values()).sort((a, b) => b.count - a.count).slice(0, 5)
  }, [data])

  function handleExport() {
    if (!filteredAttendances.length) return
    const headers = ['Tanggal', 'Nama', 'Shift', 'Check-in', 'Check-out', 'Status']
    const rows = filteredAttendances.map(a => [
      fmtDate(a.date), a.user?.name ?? '', a.shift?.name ?? '',
      a.checkInAt ? new Date(a.checkInAt).toLocaleTimeString('id-ID') : '',
      a.checkOutAt ? new Date(a.checkOutAt).toLocaleTimeString('id-ID') : '',
      STATUS_LABEL[a.status] ?? a.status,
    ])
    exportExcel('laporan-hris', { headers, rows, sheetName: 'Absensi' })
  }

  const summary = data?.summary

  const trendData = useMemo(() => {
    if (!filteredAttendances.length) return []
    const byDate = {}
    filteredAttendances.forEach(a => {
      const key = a.date
      if (!byDate[key]) byDate[key] = { date: key, PRESENT: 0, LATE: 0, HALF_DAY: 0, LEAVE: 0, ABSENT: 0 }
      byDate[key][a.status] = (byDate[key][a.status] || 0) + 1
    })
    return Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date))
  }, [filteredAttendances])

  const statusPieData = useMemo(() => {
    if (!filteredAttendances.length) return []
    const byStatus = {}
    filteredAttendances.forEach(a => { byStatus[a.status] = (byStatus[a.status] || 0) + 1 })
    return STATUS_ORDER
      .filter(s => byStatus[s] > 0)
      .map(s => ({ key: s, name: STATUS_LABEL[s], value: byStatus[s], fill: STATUS_COLOR[s] }))
  }, [filteredAttendances])

  const workModeData = useMemo(() => {
    if (!filteredAttendances.length) return []
    const byMode = {}
    filteredAttendances.forEach(a => {
      const mode = a.workMode || 'ON_SITE'
      byMode[mode] = (byMode[mode] || 0) + 1
    })
    return Object.keys(WORKMODE_LABEL)
      .filter(m => byMode[m] > 0)
      .map(m => ({ mode: m, name: WORKMODE_LABEL[m], value: byMode[m], fill: WORKMODE_COLOR[m] }))
  }, [filteredAttendances])

  return (
    <div className="px-6 py-6 max-w-5xl">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-bold text-slate-800">Laporan HRIS</h1>
          <p className="text-xs text-slate-400 mt-0.5">Rekap absensi dan cuti</p>
        </div>
        <button onClick={handleExport} disabled={!filteredAttendances.length} className="btn-secondary text-sm flex items-center gap-1.5">
          <FileDown size={14} /> Export
        </button>
      </div>

      <div className="flex gap-3 mb-6 flex-wrap items-end">
        <div>
          <label className="label">Dari Tanggal</label>
          <input type="date" className="input w-40" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
        </div>
        <div>
          <label className="label">Sampai Tanggal</label>
          <input type="date" className="input w-40" value={dateTo} onChange={e => setDateTo(e.target.value)} />
        </div>
        <div>
          <label className="label">Status</label>
          <select className="input w-40" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="ALL">Semua Status</option>
            {STATUS_ORDER.map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Karyawan</label>
          <select className="input w-48" value={userFilter} onChange={e => setUserFilter(e.target.value)}>
            <option value="ALL">Semua Karyawan</option>
            {employeeOptions.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </div>
      </div>

      {summary && (
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="card p-3 text-center">
            <p className="text-xl font-bold text-brand">{summary.totalAttendance}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Total Presensi</p>
          </div>
          <div className="card p-3 text-center">
            <p className="text-xl font-bold text-emerald-600">{summary.byStatus?.PRESENT ?? 0}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Hadir</p>
          </div>
          <div className="card p-3 text-center">
            <p className="text-xl font-bold text-purple-600">{summary.totalLeaveApproved}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Cuti Disetujui</p>
          </div>
        </div>
      )}

      {lateRanking.length > 0 && (
        <div className="card p-4 mb-4">
          <p className="text-sm font-semibold text-slate-700 mb-3">Karyawan Paling Sering Terlambat</p>
          <div className="space-y-2">
            {lateRanking.map((r, i) => (
              <div key={r.userId} className="flex items-center gap-3">
                <span className="w-5 text-xs font-semibold text-slate-400 text-center">{i + 1}</span>
                <span className="flex-1 text-sm text-slate-700">{r.name}</span>
                <span className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
                  {r.count}x terlambat
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {trendData.length > 0 && (
        <div className="card p-4 mb-4">
          <p className="text-sm font-semibold text-slate-700 mb-3">Tren Kehadiran Harian</p>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={trendData} barCategoryGap="20%">
              <CartesianGrid vertical={false} stroke="#F1F5F9" />
              <XAxis dataKey="date" tickFormatter={fmtDateShort} tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={{ stroke: '#E2E8F0' }} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} width={28} />
              <Tooltip content={<ChartTooltip />} labelFormatter={fmtDate} cursor={{ fill: '#F8FAFC' }} />
              <Legend wrapperStyle={{ fontSize: 12 }} formatter={(v) => STATUS_LABEL[v] || v} />
              {STATUS_ORDER.map(s => (
                <Bar key={s} dataKey={s} stackId="att" name={s} fill={STATUS_COLOR[s]} stroke="#fff" strokeWidth={2} radius={[2, 2, 2, 2]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {(statusPieData.length > 0 || workModeData.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {statusPieData.length > 0 && (
            <div className="card p-4">
              <p className="text-sm font-semibold text-slate-700 mb-3">Distribusi Status</p>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={statusPieData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2} stroke="#fff" strokeWidth={2}>
                    {statusPieData.map(d => <Cell key={d.key} fill={d.fill} />)}
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
          {workModeData.length > 0 && (
            <div className="card p-4">
              <p className="text-sm font-semibold text-slate-700 mb-3">Distribusi Mode Kerja</p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={workModeData} layout="vertical" margin={{ left: 8 }}>
                  <CartesianGrid horizontal={false} stroke="#F1F5F9" />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: '#475569' }} axisLine={false} tickLine={false} width={70} />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: '#F8FAFC' }} />
                  <Bar dataKey="value" name="Jumlah" radius={[0, 4, 4, 0]}>
                    {workModeData.map(d => <Cell key={d.mode} fill={d.fill} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100"><p className="text-sm font-semibold text-slate-700">Detail Presensi</p></div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr><th className="th">Tanggal</th><th className="th">Nama</th><th className="th">Shift</th><th className="th">Check-in</th><th className="th">Check-out</th><th className="th text-center">Status</th></tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={6} className="td py-8 text-center text-slate-400">Memuat…</td></tr>
              ) : filteredAttendances.length === 0 ? (
                <tr><td colSpan={6} className="td py-8 text-center text-slate-400">Tidak ada data</td></tr>
              ) : filteredAttendances.map(a => (
                <tr key={a.id} className="tr">
                  <td className="td">{fmtDate(a.date)}</td>
                  <td className="td">{a.user?.name ?? '—'}</td>
                  <td className="td">{a.shift?.name ?? '—'}</td>
                  <td className="td">{a.checkInAt ? new Date(a.checkInAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                  <td className="td">{a.checkOutAt ? new Date(a.checkOutAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                  <td className="td text-center">
                    {STATUS_LABEL[a.status] ?? a.status}
                    {a.status === 'LATE' && a.lateSeverity && (
                      <span className={`ml-1.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${SEVERITY_COLOR[a.lateSeverity.key]}`}>
                        {a.lateSeverity.label}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
