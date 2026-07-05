import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { hrisApi } from '../api'
import { useAuth } from '../context/AuthContext'
import { ClipboardCheck, FileText, ClipboardList, ArrowRight, LogIn, LogOut, CheckCircle2 } from 'lucide-react'

const fmtTime = (d) => d ? new Date(d).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '—'

export default function HRIS() {
  const { user } = useAuth()
  const now = new Date()
  const month = now.getMonth() + 1
  const year = now.getFullYear()

  const { data: today } = useQuery({ queryKey: ['hris-today'], queryFn: hrisApi.today })
  const { data: summary } = useQuery({ queryKey: ['hris-summary', month, year], queryFn: () => hrisApi.summary({ month, year }) })

  const cards = [
    { to: '/hris/attendance', icon: ClipboardCheck, label: 'Presensi', desc: 'Check-in / check-out & riwayat kehadiran' },
    { to: '/hris/leave',      icon: FileText,       label: 'Cuti',      desc: 'Ajukan & pantau status cuti' },
    { to: '/hris/overtime',   icon: ClipboardList,  label: 'Lembur',    desc: 'Ajukan & pantau status lembur' },
  ]

  return (
    <div className="px-6 py-6 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-lg font-bold text-slate-800">Halo, {user?.name}</h1>
        <p className="text-xs text-slate-400 mt-0.5">{now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
      </div>

      {/* Status presensi hari ini */}
      <div className="card p-5 mb-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center text-brand">
              <ClipboardCheck size={18} />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800">Presensi Hari Ini</p>
              {today?.checkInAt ? (
                <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
                  <span className="inline-flex items-center gap-1"><LogIn size={12} /> {fmtTime(today.checkInAt)}</span>
                  {today.checkOutAt && <span className="inline-flex items-center gap-1"><LogOut size={12} /> {fmtTime(today.checkOutAt)}</span>}
                  {today.checkOutAt && <span className="inline-flex items-center gap-1 text-emerald-600"><CheckCircle2 size={12} /> Selesai</span>}
                </p>
              ) : (
                <p className="text-xs text-slate-400 mt-0.5">Anda belum check-in hari ini</p>
              )}
            </div>
          </div>
          <Link to="/hris/attendance" className="btn-primary text-sm">
            {today?.checkInAt ? (today?.checkOutAt ? 'Lihat Riwayat' : 'Check-out') : 'Check-in Sekarang'}
          </Link>
        </div>
      </div>

      {/* Ringkasan bulan ini */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
          {[
            { key: 'PRESENT', label: 'Hadir', color: 'text-emerald-600' },
            { key: 'LATE', label: 'Terlambat', color: 'text-amber-600' },
            { key: 'ABSENT', label: 'Absen', color: 'text-red-600' },
            { key: 'LEAVE', label: 'Cuti', color: 'text-purple-600' },
            { key: 'HALF_DAY', label: 'Setengah Hari', color: 'text-blue-600' },
          ].map(({ key, label, color }) => (
            <div key={key} className="card p-3 text-center">
              <p className={`text-xl font-bold ${color}`}>{summary[key] ?? 0}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Menu cepat */}
      <div className="grid sm:grid-cols-3 gap-4">
        {cards.map(({ to, icon: Icon, label, desc }) => (
          <Link key={to} to={to} className="card p-5 hover:border-brand-light transition-colors group">
            <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center text-brand mb-3">
              <Icon size={18} />
            </div>
            <p className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
              {label}
              <ArrowRight size={13} className="opacity-0 group-hover:opacity-100 transition-opacity" />
            </p>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">{desc}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
