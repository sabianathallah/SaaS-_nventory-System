import { ShieldOff } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export default function NoPermission({ page }) {
  const navigate = useNavigate()
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center mb-5">
        <ShieldOff size={28} className="text-red-400" />
      </div>
      <h2 className="text-base font-bold text-slate-800 mb-1.5">Akses Ditolak</h2>
      <p className="text-sm text-slate-500 max-w-xs leading-relaxed mb-1">
        Kamu tidak memiliki izin untuk mengakses
        {page ? <span className="font-semibold text-slate-700"> halaman {page}</span> : ' halaman ini'}.
      </p>
      <p className="text-xs text-slate-400 mb-6">
        Hubungi admin perusahaan untuk meminta akses.
      </p>
      <button
        onClick={() => navigate('/')}
        className="btn-secondary text-sm"
      >
        Kembali ke Dashboard
      </button>
    </div>
  )
}
