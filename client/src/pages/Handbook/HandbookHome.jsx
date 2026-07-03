import { useNavigate } from 'react-router-dom'
import { ChevronRight, BookMarked, Building2, Mail, Phone, MapPin } from 'lucide-react'
import logoPreface from '../../assets/logo-preface.jpeg'
import { CONTACT_INFO } from './data/constants'

export default function HandbookHome() {
  const navigate = useNavigate()

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
      {/* ── Hero ─────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand via-red-700 to-brand-dark px-8 py-16 text-center shadow-card-md">
        {/* Floating background decoration */}
        <div className="pointer-events-none absolute -top-20 -left-20 w-72 h-72 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-16 -right-16 w-56 h-56 rounded-full bg-white/10 blur-2xl" />

        <div className="relative animate-slide-up">
          <img
            src={logoPreface}
            alt="Preface"
            className="w-16 h-16 mx-auto rounded-xl object-cover shadow-[0_8px_24px_rgba(0,0,0,0.25)]"
          />
          <h1 className="mt-5 text-4xl font-black tracking-tight text-white [text-shadow:0_4px_12px_rgba(0,0,0,0.3)]">
            PREFACE
          </h1>
          <div className="mt-2 [animation-delay:150ms] animate-fade-in">
            <p className="text-lg font-bold tracking-[3px] text-white/95 uppercase">Handbook</p>
            <div className="mx-auto mt-2 h-[3px] w-14 rounded-full bg-white" />
          </div>
          <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-white/90 [animation-delay:250ms] animate-fade-in">
            Panduan lengkap kebijakan, budaya kerja, dan nilai-nilai perusahaan PREFACE.
          </p>
          <button
            type="button"
            onClick={() => navigate('/handbook/kebijakan')}
            className="mt-6 inline-flex items-center gap-1.5 rounded-lg bg-white px-6 py-2.5 text-sm font-bold text-brand shadow-[0_8px_24px_rgba(0,0,0,0.2)] transition-all hover:-translate-y-0.5 hover:shadow-[0_12px_32px_rgba(0,0,0,0.3)]"
          >
            Lihat Kebijakan <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* ── Quick links ──────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <button
          type="button"
          onClick={() => navigate('/handbook/kebijakan')}
          className="card p-5 text-left transition-all hover:shadow-card-md hover:-translate-y-0.5"
        >
          <div className="w-10 h-10 rounded-lg bg-brand-50 flex items-center justify-center text-brand mb-3">
            <BookMarked size={18} />
          </div>
          <p className="text-sm font-bold text-slate-800">Kebijakan Perusahaan</p>
          <p className="text-xs text-slate-400 mt-1">10 kebijakan di 7 kategori — cuti, lembur, kode etik, dan lainnya.</p>
        </button>
        <button
          type="button"
          onClick={() => navigate('/handbook/struktur')}
          className="card p-5 text-left transition-all hover:shadow-card-md hover:-translate-y-0.5"
        >
          <div className="w-10 h-10 rounded-lg bg-brand-50 flex items-center justify-center text-brand mb-3">
            <Building2 size={18} />
          </div>
          <p className="text-sm font-bold text-slate-800">Struktur Organisasi</p>
          <p className="text-xs text-slate-400 mt-1">Susunan divisi dan penanggung jawab di setiap unit kerja.</p>
        </button>
      </div>

      {/* ── Contact footer ───────────────────────────────────────── */}
      <div className="card p-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Perlu Bantuan?</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm text-slate-600">
          <a href={`mailto:${CONTACT_INFO.email}`} className="flex items-center gap-2 hover:text-brand transition-colors">
            <Mail size={14} className="text-slate-400 flex-shrink-0" /> {CONTACT_INFO.email}
          </a>
          <a href={`tel:${CONTACT_INFO.phone.replace(/\s/g, '')}`} className="flex items-center gap-2 hover:text-brand transition-colors">
            <Phone size={14} className="text-slate-400 flex-shrink-0" /> {CONTACT_INFO.phone}
          </a>
          <span className="flex items-start gap-2 text-slate-500">
            <MapPin size={14} className="text-slate-400 flex-shrink-0 mt-0.5" /> {CONTACT_INFO.address}
          </span>
        </div>
      </div>
    </div>
  )
}
