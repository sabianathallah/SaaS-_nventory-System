import { useNavigate } from 'react-router-dom'
import { ArrowRight, Package, Users, CheckCircle2, Clock } from 'lucide-react'
import logoPreface from '../assets/logo-preface.jpeg'

const MODULES = [
  {
    id: 'inventory',
    tag: 'LIVE',
    icon: Package,
    name: 'Inventory System',
    desc: 'Kelola stok, gudang, penerimaan barang, pengeluaran, opname, dan laporan bulanan dalam satu sistem.',
    features: ['Multi-gudang', 'Stock In / Out', 'Handover & Resi', 'Laporan Bulanan'],
    active: true,
  },
  {
    id: 'hris',
    tag: 'SOON',
    icon: Users,
    name: 'HRIS',
    desc: 'Human Resource Information System — kelola karyawan, absensi, dan payroll. Coming soon.',
    features: ['Manajemen Karyawan', 'Absensi', 'Payroll', 'Performa'],
    active: false,
  },
]

export default function Landing() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white overflow-x-hidden">

      {/* ── Noise texture overlay ── */}
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.03] z-0"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'repeat',
          backgroundSize: '128px',
        }}
      />

      <div className="relative z-10">

        {/* ── Nav ── */}
        <nav className="flex items-center justify-between px-6 md:px-12 py-5 border-b border-white/5">
          <div className="flex items-center gap-3">
            <img src={logoPreface} alt="Preface" className="w-8 h-8 rounded-md object-cover" />
            <span className="font-black text-sm tracking-[0.15em] uppercase text-white">Preface System</span>
          </div>
          <button
            onClick={() => navigate('/login')}
            className="flex items-center gap-2 text-xs font-bold tracking-widest uppercase text-white/60 hover:text-white transition-colors"
          >
            Masuk <ArrowRight size={13} />
          </button>
        </nav>

        {/* ── Hero ── */}
        <section className="px-6 md:px-12 pt-20 pb-16 md:pt-28 md:pb-24">
          {/* Label */}
          <div className="inline-flex items-center gap-2 mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-[#C8102E] animate-pulse" />
            <span className="text-[10px] font-bold tracking-[0.25em] uppercase text-[#C8102E]">
              Internal Platform — Preface Wearhouse
            </span>
          </div>

          {/* Headline */}
          <h1 className="text-[clamp(2.5rem,8vw,6rem)] font-black leading-[0.95] tracking-tight uppercase mb-8 max-w-4xl">
            Satu Platform<br />
            <span className="text-[#C8102E]">Semua</span>{' '}
            Operasional.
          </h1>

          <p className="text-white/40 text-sm md:text-base max-w-md leading-relaxed mb-10">
            Sistem terpusat untuk kelola inventori, SDM, dan seluruh operasional bisnis Preface Wearhouse.
          </p>

          <button
            onClick={() => navigate('/login')}
            className="group inline-flex items-center gap-3 bg-[#C8102E] hover:bg-[#E01535] text-white font-black text-xs tracking-[0.2em] uppercase px-7 py-4 transition-all duration-200 hover:gap-4"
          >
            Masuk ke Sistem
            <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
          </button>
        </section>

        {/* ── Divider ── */}
        <div className="px-6 md:px-12">
          <div className="h-px bg-white/5" />
        </div>

        {/* ── Modules ── */}
        <section className="px-6 md:px-12 py-16 md:py-24">
          <div className="flex items-end justify-between mb-10 flex-wrap gap-4">
            <div>
              <p className="text-[10px] font-bold tracking-[0.25em] uppercase text-white/30 mb-2">Modul</p>
              <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tight">Platform Suite</h2>
            </div>
            <p className="text-white/30 text-xs max-w-xs text-right leading-relaxed">
              Dibangun modular — setiap sistem terhubung dalam satu ekosistem.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {MODULES.map((mod) => {
              const Icon = mod.icon
              return (
                <div
                  key={mod.id}
                  className={`relative border p-7 md:p-9 transition-all duration-200 ${
                    mod.active
                      ? 'border-[#C8102E]/40 bg-[#C8102E]/5 hover:bg-[#C8102E]/8'
                      : 'border-white/5 bg-white/[0.02]'
                  }`}
                >
                  {/* Tag */}
                  <div className="flex items-start justify-between mb-8">
                    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[9px] font-black tracking-[0.2em] uppercase ${
                      mod.active ? 'bg-[#C8102E] text-white' : 'bg-white/5 text-white/30'
                    }`}>
                      {mod.active && <span className="w-1 h-1 rounded-full bg-white/80 animate-pulse" />}
                      {mod.tag}
                    </div>
                    <Icon size={18} className={mod.active ? 'text-[#C8102E]' : 'text-white/15'} />
                  </div>

                  {/* Name */}
                  <h3 className={`text-xl md:text-2xl font-black uppercase tracking-tight mb-3 ${
                    mod.active ? 'text-white' : 'text-white/25'
                  }`}>
                    {mod.name}
                  </h3>

                  <p className={`text-xs leading-relaxed mb-7 ${mod.active ? 'text-white/40' : 'text-white/20'}`}>
                    {mod.desc}
                  </p>

                  {/* Features */}
                  <ul className="space-y-2">
                    {mod.features.map((f) => (
                      <li key={f} className={`flex items-center gap-2.5 text-xs font-medium ${
                        mod.active ? 'text-white/60' : 'text-white/15'
                      }`}>
                        {mod.active
                          ? <CheckCircle2 size={11} className="text-[#C8102E] flex-shrink-0" />
                          : <Clock size={11} className="text-white/20 flex-shrink-0" />
                        }
                        {f}
                      </li>
                    ))}
                  </ul>

                  {/* CTA */}
                  {mod.active && (
                    <button
                      onClick={() => navigate('/login')}
                      className="mt-8 flex items-center gap-2 text-[10px] font-black tracking-[0.2em] uppercase text-[#C8102E] hover:gap-3 transition-all"
                    >
                      Buka Modul <ArrowRight size={11} />
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </section>

        {/* ── Footer ── */}
        <footer className="px-6 md:px-12 py-8 border-t border-white/5 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <img src={logoPreface} alt="Preface" className="w-5 h-5 rounded object-cover opacity-50" />
            <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-white/20">Preface Wearhouse</span>
          </div>
          <p className="text-[10px] text-white/15 tracking-wider">
            © {new Date().getFullYear()} — Internal Use Only
          </p>
        </footer>

      </div>
    </div>
  )
}
