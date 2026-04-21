import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Loader2, ArrowRight } from 'lucide-react'
import logoPreface from '../assets/logo-preface.jpeg'

const RED = '#C8102E'

const DEMOS = [
  { email: 'superadmin@inventory.local', role: 'Super Admin' },
  { email: 'admin@inventory.local',      role: 'Admin' },
  { email: 'staff@inventory.local',      role: 'Staff' },
]

export default function Login() {
  const { signIn }  = useAuth()
  const navigate    = useNavigate()
  const [form, setForm]       = useState({ email: '', password: '' })
  const [loading, setLoading] = useState(false)

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
              <input
                type="password"
                className="input"
                placeholder="Masukkan password"
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                required
              />
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

          {/* Demo accounts */}
          <div className="mt-7 pt-6 border-t border-slate-100">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">Akun Demo</p>
            <div className="space-y-2">
              {DEMOS.map(({ email, role }) => (
                <button
                  key={email}
                  type="button"
                  onClick={() => setForm({ email, password: 'password123' })}
                  className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg bg-slate-50 border border-slate-200 text-left transition-all group"
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = `${RED}66`
                    e.currentTarget.style.background = '#FFF1F1'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = ''
                    e.currentTarget.style.background = ''
                  }}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-700 truncate">{email}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">Password: password123</p>
                  </div>
                  {/* Role badge — inline style */}
                  <span
                    className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold border flex-shrink-0"
                    style={
                      role === 'Super Admin'
                        ? { background: '#FFF1F1', color: RED, borderColor: '#FECACA' }
                        : role === 'Admin'
                        ? { background: '#DBEAFE', color: '#2563EB', borderColor: '#BFDBFE' }
                        : { background: '#F1F5F9', color: '#64748B', borderColor: '#E2E8F0' }
                    }
                  >
                    {role}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
