import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Store, PackageCheck, Receipt, CalendarClock, ArrowRight } from 'lucide-react'
import { posApi } from '../api'
import PageHeader from '../components/PageHeader'
import { useAuth } from '../context/AuthContext'

// Beranda modul POS: pilih event yang sedang berjalan untuk membuka kasir.
export default function PosHome() {
  const navigate = useNavigate()
  const { hasPermission } = useAuth()
  const can = (...k) => hasPermission('pos.manage') || k.some(hasPermission)
  const { data: events = [], isLoading } = useQuery({ queryKey: ['pos-events'], queryFn: posApi.events })
  const open = events.filter(e => e.status === 'OPEN')
  const prep = events.filter(e => e.status === 'PREP')

  return (
    <div className="px-6 py-6 space-y-6">
      <PageHeader title="POS / Kasir" subtitle="Pilih event yang sedang berjalan untuk mulai jualan" />

      {isLoading ? <p className="text-sm text-slate-400">Memuat…</p> : !open.length ? (
        <div className="card p-8 text-center">
          <Store className="mx-auto text-slate-300" size={36} />
          <p className="mt-3 font-semibold text-slate-700">Belum ada event yang berjalan</p>
          <p className="text-sm text-slate-500">{prep.length ? `${prep.length} event masih persiapan — klik Mulai di menu Event.` : 'Buat event dulu di menu Event & Laporan.'}</p>
          {can('pos.event.manage') && <button className="btn-primary mx-auto mt-4" onClick={() => navigate('/pos/events')}><CalendarClock size={14} />Kelola event</button>}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {open.map(ev => (
            <div key={ev.id} className="card p-5 flex flex-col">
              <span className="badge-green self-start">Berjalan</span>
              <p className="mt-3 text-lg font-bold text-slate-900">{ev.name}</p>
              <p className="text-sm text-slate-500">{[ev.location, ev.Warehouse?.name].filter(Boolean).join(' · ')}</p>
              <div className="mt-5 grid gap-2">
                {can('pos.sell') && (
                  <button className="h-12 rounded-xl bg-brand text-white font-bold inline-flex items-center justify-center gap-2 hover:brightness-110" onClick={() => navigate(`/pos/kasir/${ev.id}`)}>
                    <Store size={16} />Buka kasir<ArrowRight size={16} />
                  </button>
                )}
                <div className="grid grid-cols-2 gap-2">
                  {can('pos.fulfill', 'pos.sell') && <button className="btn-secondary justify-center" onClick={() => navigate(`/pos/pickup?event=${ev.id}`)}><PackageCheck size={14} />Antrean ambil</button>}
                  <button className="btn-secondary justify-center" onClick={() => navigate(`/pos/history?event=${ev.id}`)}><Receipt size={14} />Riwayat</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
