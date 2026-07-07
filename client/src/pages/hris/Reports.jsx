import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { hrisApi } from '../../api'
import { exportExcel } from '../../utils/exportExcel'
import { FileDown } from 'lucide-react'

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
const STATUS_LABEL = { PRESENT: 'Hadir', LATE: 'Terlambat', ABSENT: 'Absen', LEAVE: 'Cuti', HALF_DAY: 'Setengah Hari' }

export default function Reports() {
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['hris-report', dateFrom, dateTo],
    queryFn: () => hrisApi.attendanceReport({ ...(dateFrom && { dateFrom }), ...(dateTo && { dateTo }) }),
  })

  function handleExport() {
    if (!data?.attendances?.length) return
    const headers = ['Tanggal', 'Nama', 'Shift', 'Check-in', 'Check-out', 'Status']
    const rows = data.attendances.map(a => [
      fmtDate(a.date), a.user?.name ?? '', a.shift?.name ?? '',
      a.checkInAt ? new Date(a.checkInAt).toLocaleTimeString('id-ID') : '',
      a.checkOutAt ? new Date(a.checkOutAt).toLocaleTimeString('id-ID') : '',
      STATUS_LABEL[a.status] ?? a.status,
    ])
    exportExcel('laporan-hris', { headers, rows, sheetName: 'Absensi' })
  }

  const summary = data?.summary

  return (
    <div className="px-6 py-6 max-w-5xl">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-bold text-slate-800">Laporan HRIS</h1>
          <p className="text-xs text-slate-400 mt-0.5">Rekap absensi dan cuti</p>
        </div>
        <button onClick={handleExport} disabled={!data?.attendances?.length} className="btn-secondary text-sm flex items-center gap-1.5">
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
              ) : (data?.attendances ?? []).length === 0 ? (
                <tr><td colSpan={6} className="td py-8 text-center text-slate-400">Tidak ada data</td></tr>
              ) : data.attendances.map(a => (
                <tr key={a.id} className="tr">
                  <td className="td">{fmtDate(a.date)}</td>
                  <td className="td">{a.user?.name ?? '—'}</td>
                  <td className="td">{a.shift?.name ?? '—'}</td>
                  <td className="td">{a.checkInAt ? new Date(a.checkInAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                  <td className="td">{a.checkOutAt ? new Date(a.checkOutAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                  <td className="td text-center">{STATUS_LABEL[a.status] ?? a.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
