import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Loader2, ArrowRight, Eye, EyeOff } from 'lucide-react'
import logoPreface from '../assets/logo-preface.jpeg'

const RED = '#C8102E'

export default function Login() {
  const { signIn }  = useAuth()
  const navigate    = useNavigate()
  const [form, setForm]       = useState({ email: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [showPwd, setShowPwd] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      await signIn(form.email, form.password)
      navigate('/')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Invalid email or password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex bg-canvas">

      {/* ── Left panel — broken white ─────────────────────────── */}
      <div
        className="hidden lg:flex w-[420px] flex-col justify-between p-10 flex-shrink-0"
        style={{ background: '#F5F3EF', borderRight: '1px solid #E0DDD7' }}
      >
        {/* Brand */}
        <div className="flex items-center gap-3">
          <img src={logoPreface} alt="Preface" className="w-9 h-9 rounded-md object-cover" />
          <div>
            <p className="font-bold text-slate-800 text-base leading-tight">Preface</p>
            <p className="text-[11px] text-slate-400 leading-tight">Inventory System</p>
          </div>
        </div>

        {/* Copy */}
        <div>
          <div className="mb-6">
            {/* Badge merah — inline style */}
            <span
              className="inline-block px-2.5 py-1 rounded-md text-xs font-bold text-white mb-4"
              style={{ background: RED }}
            >
              Inventory Management
            </span>
            <h1 className="text-3xl font-bold text-slate-800 leading-snug">
              Kelola inventori<br />lebih mudah &amp; cepat
            </h1>
            <p className="text-sm mt-3 leading-relaxed text-slate-500">
              Pantau stok real-time, kelola multi-gudang, dan optimalkan rantai pasok dalam satu platform.
            </p>
          </div>

          <div className="space-y-3">
            {[
              'Real-time stock tracking',
              'Multi-warehouse management',
              'Stock IN / OUT transactions',
              'Role-based access control',
            ].map(f => (
              <div key={f} className="flex items-center gap-2.5">
                {/* Lingkaran checklist — inline style merah */}
                <div
                  className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: RED }}
                >
                  <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
                    <path d="M1 3L3 5L7 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <span className="text-sm text-slate-600">{f}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="text-[11px] text-slate-400">© 2026 Preface. All rights reserved.</p>
      </div>

      {/* ── Right panel — putih bersih ────────────────────────── */}
      <div className="flex-1 flex items-center justify-center p-6 bg-white">
        <div className="w-full max-w-sm animate-slide-up">

          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            <img src={logoPreface} alt="Preface" className="w-8 h-8 rounded-md object-cover" />
            <div>
              <p className="font-bold text-slate-800 text-sm leading-tight">Preface</p>
              <p className="text-[11px] text-slate-400 leading-tight">Inventory System</p>
            </div>
          </div>

          <div className="mb-7">
            <h2 className="text-2xl font-bold text-slate-800">Selamat datang</h2>
            <p className="text-sm text-slate-500 mt-1">Masuk ke akun Anda untuk melanjutkan</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Email</label>
              <input
                type="email"
                className="input"
                placeholder="anda@perusahaan.com"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                required
                autoFocus
              />
            </div>
            <div>
              <label className="label">Password</label>
              <div className="relative">
                <input
                  type={showPwd ? 'text' : 'password'}
                  className="input pr-10"
                  placeholder="Masukkan password"
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  tabIndex={-1}
                >
                  {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {/* Tombol submit — inline style merah */}
            <button
              type="submit"
              disabled={loading}
              className="w-full inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 mt-1 text-sm font-semibold rounded text-white shadow-sm transition-all active:scale-[0.98] disabled:opacity-50"
              style={{ background: loading ? '#A00D26' : RED }}
              onMouseEnter={e => { if (!loading) e.currentTarget.style.background = '#D93248' }}
              onMouseLeave={e => { if (!loading) e.currentTarget.style.background = RED }}
            >
              {loading
                ? <><Loader2 size={14} className="animate-spin" /> Masuk…</>
                : <><span>Masuk</span><ArrowRight size={14} /></>
              }
            </button>
          </form>

        </div>
      </div>
    </div>
  )
}
