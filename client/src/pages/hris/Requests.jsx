import { useSearchParams } from 'react-router-dom'
import { FileText, Laptop, AlarmClock } from 'lucide-react'
import Leave from './Leave'
import Wfa from './Wfa'
import LateExcuse from './LateExcuse'

// Hub "Pengajuan" — gabungan Cuti, WFA, dan Izin Telat jadi satu halaman
// dengan tab, mengikuti pola yang sama seperti "Pengajuan Stok" di module
// Inventory, dan pola umum HRIS SaaS besar (Mekari Talenta, Gusto) yang
// mengelompokkan semua jenis pengajuan di satu hub "Time Off", bukan nav
// terpisah per jenis. Komponen Leave/Wfa/LateExcuse sengaja tidak diubah
// sama sekali, cuma di-render sebagai tab panel — supaya gampang di-revert
// ke nav terpisah kalau ternyata dirasa kurang cocok.
const TABS = [
  { value: 'cuti', label: 'Cuti', icon: FileText, Component: Leave },
  { value: 'wfa',  label: 'WFA',  icon: Laptop,   Component: Wfa },
  { value: 'izin-telat', label: 'Izin Telat', icon: AlarmClock, Component: LateExcuse },
]

export default function Requests() {
  const [searchParams, setSearchParams] = useSearchParams()
  const active = TABS.find(t => t.value === searchParams.get('tab'))?.value ?? 'cuti'

  function setActive(value) {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      next.set('tab', value)
      return next
    })
  }

  const ActivePanel = TABS.find(t => t.value === active)?.Component ?? Leave

  return (
    <div>
      <div className="px-6 pt-6">
        <div className="flex gap-1 border-b border-slate-200">
          {TABS.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              onClick={() => setActive(value)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                active === value
                  ? 'border-brand text-brand'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>
      </div>
      <ActivePanel />
    </div>
  )
}
