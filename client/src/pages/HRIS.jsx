import { UserCog, Clock3 } from 'lucide-react'

export default function HRIS() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-16">
      <div className="card p-10 text-center">
        <div className="w-14 h-14 rounded-2xl bg-brand-50 flex items-center justify-center text-brand mx-auto mb-5">
          <UserCog size={24} />
        </div>
        <h1 className="text-xl font-bold text-slate-800">HRIS</h1>
        <p className="text-sm text-slate-500 mt-2 max-w-md mx-auto leading-relaxed">
          Modul HR Information System — data karyawan, absensi, cuti, dan payroll —
          sedang dalam pengembangan.
        </p>
        <div className="inline-flex items-center gap-1.5 mt-5 px-3 py-1.5 rounded-full bg-slate-100 text-slate-500 text-xs font-semibold">
          <Clock3 size={13} /> Coming Soon
        </div>
      </div>
    </div>
  )
}
