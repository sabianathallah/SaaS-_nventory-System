import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { MapPin, Camera, Timer, ChevronRight } from 'lucide-react'
import { hrisApi } from '../../api'

const fmtTime = (d) => d ? new Date(d).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '—'
const fmtDur = (m) => {
  const h = Math.floor(m / 60), mm = m % 60
  return h && mm ? `${h}j ${mm}m` : h ? `${h}j` : `${mm}m`
}
const MODE_LABEL = { ON_SITE: 'On-site', WFA: 'WFA', FIELD: 'Lapangan' }

// Ringkasan status presensi hari ini di Personal Dashboard — aksi
// check-in/out sungguhan (kamera + GPS) tetap di /hris/attendance, widget
// ini cuma baca status & jadi pintu masuk cepat kesana (lihat Attendance.jsx
// untuk alur lengkapnya, sengaja tidak diduplikasi di sini).
export default function PresensiWidget() {
  const navigate = useNavigate()
  const { data: today, isLoading } = useQuery({ queryKey: ['hris-today'], queryFn: hrisApi.today })
  const { data: settings } = useQuery({ queryKey: ['hris-settings'], queryFn: hrisApi.hrisSettings })
  const minWorkMinutes = settings?.minWorkMinutes ?? 480

  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!today?.checkInAt || today?.checkOutAt) return
    const t = setInterval(() => setNow(Date.now()), 30000)
    return () => clearInterval(t)
  }, [today?.checkInAt, today?.checkOutAt])

  const worked = today?.checkInAt && !today?.checkOutAt
    ? Math.max(0, Math.floor((now - new Date(today.checkInAt).getTime()) / 60000))
    : 0
  const pct = Math.min(100, Math.round((worked / minWorkMinutes) * 100))

  return (
    <button
      onClick={() => navigate('/hris/attendance')}
      className="card p-5 text-left w-full hover:shadow-md hover:-translate-y-0.5 transition-all duration-150"
    >
      <div className="flex items-center justify-between gap-3 mb-1">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-info-light">
            <MapPin size={18} className="text-info" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-800">Presensi Hari Ini</p>
            {isLoading ? (
              <div className="h-3.5 w-32 bg-slate-100 rounded animate-pulse mt-1" />
            ) : !today?.checkInAt ? (
              <p className="text-xs text-slate-400">Belum check-in</p>
            ) : !today?.checkOutAt ? (
              <p className="text-xs text-slate-400">
                Check-in {fmtTime(today.checkInAt)}
                {today.workMode && today.workMode !== 'ON_SITE' && ` · ${MODE_LABEL[today.workMode]}`}
              </p>
            ) : (
              <p className="text-xs text-success font-medium">Selesai · {fmtTime(today.checkInAt)}–{fmtTime(today.checkOutAt)}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {!today?.checkInAt ? (
            <span className="btn-primary text-xs py-1.5"><Camera size={12} /> Check-in</span>
          ) : !today?.checkOutAt ? (
            <span className="btn-secondary text-xs py-1.5"><Camera size={12} /> Check-out</span>
          ) : (
            <span className="text-[10px] font-bold text-success bg-success-light px-2 py-1 rounded-full">Beres</span>
          )}
          <ChevronRight size={16} className="text-slate-300" />
        </div>
      </div>

      {today?.checkInAt && !today?.checkOutAt && (
        <div className="mt-3 pt-3 border-t border-slate-100">
          <div className="flex items-center justify-between text-[11px] mb-1.5">
            <span className="flex items-center gap-1 font-medium text-slate-500">
              <Timer size={11} /> {fmtDur(worked)} / {fmtDur(minWorkMinutes)}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
            <div className="h-full rounded-full bg-info transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}
    </button>
  )
}
