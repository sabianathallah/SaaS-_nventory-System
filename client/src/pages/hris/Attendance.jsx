import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { hrisApi } from '../../api'
import { useAuth } from '../../context/AuthContext'
import { LogIn, LogOut, MapPin, Loader2 } from 'lucide-react'

const STATUS_LABEL = { PRESENT: 'Hadir', LATE: 'Terlambat', ABSENT: 'Absen', LEAVE: 'Cuti', HALF_DAY: 'Setengah Hari' }
const STATUS_COLOR = {
  PRESENT: 'badge-green', LATE: 'badge-amber', ABSENT: 'badge-red',
  LEAVE: 'badge-purple', HALF_DAY: 'badge-teal',
}

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
const fmtTime = (d) => d ? new Date(d).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '—'

function getLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('Geolocation tidak didukung browser ini'))
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => reject(new Error(err.message || 'Gagal mengambil lokasi')),
      { enableHighAccuracy: true, timeout: 10000 }
    )
  })
}

export default function Attendance() {
  const { hasPermission, user } = useAuth()
  const qc = useQueryClient()
  const canViewAll = hasPermission('hris.attendance.edit') || hasPermission('hris.reports.view') || user?.role === 'SUPER_ADMIN' || user?.role === 'COMPANY_ADMIN'
  const [locating, setLocating] = useState(false)

  const { data: today } = useQuery({ queryKey: ['hris-today'], queryFn: hrisApi.today })
  const { data: history, isLoading } = useQuery({
    queryKey: ['hris-attendance-list'],
    queryFn: () => hrisApi.attendanceList({ limit: 30 }),
  })

  const invalidate = () => { qc.invalidateQueries({ queryKey: ['hris-today'] }); qc.invalidateQueries({ queryKey: ['hris-attendance-list'] }) }

  const checkIn = useMutation({
    mutationFn: hrisApi.checkIn,
    onSuccess: () => { toast.success('Check-in berhasil'); invalidate() },
    onError: (e) => toast.error(e.response?.data?.message ?? 'Gagal check-in'),
  })
  const checkOut = useMutation({
    mutationFn: hrisApi.checkOut,
    onSuccess: () => { toast.success('Check-out berhasil'); invalidate() },
    onError: (e) => toast.error(e.response?.data?.message ?? 'Gagal check-out'),
  })

  async function handleCheckIn() {
    setLocating(true)
    try {
      const { lat, lng } = await getLocation()
      checkIn.mutate({ lat, lng })
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLocating(false)
    }
  }

  async function handleCheckOut() {
    setLocating(true)
    try {
      const { lat, lng } = await getLocation()
      checkOut.mutate({ lat, lng })
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLocating(false)
    }
  }

  const rows = history?.data ?? []
  const busy = locating || checkIn.isPending || checkOut.isPending

  return (
    <div className="px-6 py-6 max-w-5xl">
      <div className="mb-5">
        <h1 className="text-lg font-bold text-slate-800">Presensi</h1>
        <p className="text-xs text-slate-400 mt-0.5">Check-in dan check-out memerlukan izin lokasi (GPS) untuk validasi jarak ke kantor</p>
      </div>

      <div className="card p-5 mb-6 flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center text-brand">
            <MapPin size={18} />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800">Hari ini, {fmtDate(new Date())}</p>
            <p className="text-xs text-slate-500 mt-0.5">
              {today?.checkInAt ? `Check-in ${fmtTime(today.checkInAt)}` : 'Belum check-in'}
              {today?.checkOutAt && ` · Check-out ${fmtTime(today.checkOutAt)}`}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {!today?.checkInAt && (
            <button onClick={handleCheckIn} disabled={busy} className="btn-primary text-sm">
              {busy ? <Loader2 size={14} className="animate-spin" /> : <LogIn size={14} />} Check-in
            </button>
          )}
          {today?.checkInAt && !today?.checkOutAt && (
            <button onClick={handleCheckOut} disabled={busy} className="btn-primary text-sm">
              {busy ? <Loader2 size={14} className="animate-spin" /> : <LogOut size={14} />} Check-out
            </button>
          )}
          {today?.checkInAt && today?.checkOutAt && (
            <span className="badge-green">Presensi hari ini selesai</span>
          )}
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100">
          <p className="text-sm font-semibold text-slate-700">Riwayat Presensi</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="th">Tanggal</th>
                {canViewAll && <th className="th">Nama</th>}
                <th className="th">Check-in</th>
                <th className="th">Check-out</th>
                <th className="th">Shift</th>
                <th className="th text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={6} className="td py-8 text-center text-slate-400">Memuat…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={6} className="td py-8 text-center text-slate-400">Belum ada data presensi</td></tr>
              ) : rows.map(r => (
                <tr key={r.id} className="tr">
                  <td className="td">{fmtDate(r.date)}</td>
                  {canViewAll && <td className="td">{r.user?.name ?? '—'}</td>}
                  <td className="td">{fmtTime(r.checkInAt)}</td>
                  <td className="td">{fmtTime(r.checkOutAt)}</td>
                  <td className="td">{r.shift?.name ?? '—'}</td>
                  <td className="td text-center"><span className={STATUS_COLOR[r.status]}>{STATUS_LABEL[r.status]}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
