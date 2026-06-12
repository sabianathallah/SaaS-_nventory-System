import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useNavigate, Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Loader2, ArrowRight, Eye, EyeOff, ArrowLeft } from 'lucide-react'
import logoPreface from '../assets/logo-preface.jpeg'

const MAROON = '#A0141E'

const modules = [
  'Preface HRIS System',
  'Preface Inventory System',
  'Preface Task System',
  'Preface Finance System',
  'Vendor Portal System',
]

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
      navigate('/dashboard')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Invalid email or password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex' }}>

      {/* ── Left panel ──────────────────────────────────────────── */}
      <div
        className="hidden lg:flex"
        style={{
          width: 420,
          flexShrink: 0,
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '40px 40px 36px',
          background: '#F5F3EF',
          borderRight: '1px solid #E0DDD7',
        }}
      >
        {/* Brand header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <img
            src={logoPreface}
            alt="Preface"
            style={{ width: 36, height: 36, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }}
          />
          <div>
            <p style={{ fontWeight: 700, color: '#1a1714', fontSize: 14, lineHeight: 1.2, margin: 0 }}>
              Preface
            </p>
            <p style={{
              fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em',
              color: '#9a9690', margin: 0, lineHeight: 1.4,
            }}>
              Internal Platform
            </p>
          </div>
        </div>

        {/* Center block */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 20 }}>
          {/* Badge */}
          <span style={{
            display: 'inline-block',
            alignSelf: 'flex-start',
            padding: '4px 10px',
            background: 'rgba(160,20,30,0.08)',
            border: '0.5px solid rgba(160,20,30,0.3)',
            color: MAROON,
            fontSize: 10,
            textTransform: 'uppercase',
            letterSpacing: '0.16em',
            borderRadius: 3,
          }}>
            Restricted Access
          </span>

          {/* Headline */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <h1 style={{
              fontSize: 20, fontWeight: 600, color: '#1a1714',
              lineHeight: 1.25, margin: 0,
            }}>
              One system. Full control.
            </h1>
            <p style={{ fontSize: 12, color: '#7a7672', lineHeight: 1.6, margin: 0 }}>
              Authorized personnel only. All activity is monitored and logged.
            </p>
          </div>

          {/* Module list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
            {modules.map(m => (
              <div key={m} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 5, height: 5, borderRadius: '50%',
                  background: MAROON, flexShrink: 0,
                }} />
                <span style={{ fontSize: 12, color: '#5a5652' }}>{m}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <p style={{ fontSize: 10, color: '#b0aca6', letterSpacing: '0.08em', margin: 0 }}>
          © 2025 Preface System — Internal Use Only
        </p>
      </div>

      {/* ── Right panel ─────────────────────────────────────────── */}
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        background: '#FFFFFF',
        position: 'relative',
      }}>
        {/* Back to home */}
        <Link
          to="/"
          style={{
            position: 'absolute',
            top: 20,
            left: 20,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            fontSize: 11,
            color: '#9a9690',
            textDecoration: 'none',
            letterSpacing: '0.04em',
            transition: 'color 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.color = MAROON}
          onMouseLeave={e => e.currentTarget.style.color = '#9a9690'}
        >
          <ArrowLeft size={12} /> Back to home
        </Link>
        <div style={{ width: '100%', maxWidth: 360 }} className="animate-slide-up">

          {/* Mobile logo */}
          <div className="lg:hidden" style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 32 }}>
            <img
              src={logoPreface}
              alt="Preface"
              style={{ width: 32, height: 32, borderRadius: 6, objectFit: 'cover' }}
            />
            <div>
              <p style={{ fontWeight: 700, color: '#1a1714', fontSize: 13, lineHeight: 1.2, margin: 0 }}>Preface</p>
              <p style={{ fontSize: 10, color: '#9a9690', textTransform: 'uppercase', letterSpacing: '0.12em', margin: 0 }}>
                Internal Platform
              </p>
            </div>
          </div>

          {/* Header block */}
          <div style={{ marginBottom: 32 }}>
            <p style={{
              fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.18em',
              color: '#9a9690', margin: '0 0 8px',
            }}>
              Preface System
            </p>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: '#1a1714', margin: '0 0 6px' }}>
              Welcome back
            </h2>
            <p style={{ fontSize: 13, color: '#7a7672', margin: 0 }}>
              Sign in to your account and keep it moving
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* Email */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{
                fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.14em', color: '#9a9690',
              }}>
                Email
              </label>
              <input
                type="email"
                placeholder="name@prefacewearhouse.com"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                required
                autoFocus
                style={{
                  border: 'none',
                  borderBottom: '1px solid #d4d0c8',
                  outline: 'none',
                  background: 'transparent',
                  padding: '6px 0',
                  fontSize: 14,
                  color: '#1a1714',
                }}
                onFocus={e => e.target.style.borderBottomColor = MAROON}
                onBlur={e => e.target.style.borderBottomColor = '#d4d0c8'}
              />
            </div>

            {/* Password */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{
                fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.14em', color: '#9a9690',
              }}>
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPwd ? 'text' : 'password'}
                  placeholder="drop your password here"
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  required
                  style={{
                    width: '100%',
                    border: 'none',
                    borderBottom: '1px solid #d4d0c8',
                    outline: 'none',
                    background: 'transparent',
                    padding: '6px 28px 6px 0',
                    fontSize: 14,
                    color: '#1a1714',
                    boxSizing: 'border-box',
                  }}
                  onFocus={e => e.target.style.borderBottomColor = MAROON}
                  onBlur={e => e.target.style.borderBottomColor = '#d4d0c8'}
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(v => !v)}
                  tabIndex={-1}
                  style={{
                    position: 'absolute',
                    right: 0,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    cursor: 'pointer',
                    color: '#9a9690',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                padding: '11px 16px',
                background: loading ? '#8a1019' : MAROON,
                color: '#ffffff',
                border: 'none',
                borderRadius: 3,
                fontSize: 13,
                fontWeight: 600,
                letterSpacing: '0.04em',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.75 : 1,
                transition: 'background 0.15s',
                marginTop: 4,
              }}
              onMouseEnter={e => { if (!loading) e.currentTarget.style.background = '#c01925' }}
              onMouseLeave={e => { if (!loading) e.currentTarget.style.background = MAROON }}
            >
              {loading
                ? <><Loader2 size={14} className="animate-spin" /> Signing in…</>
                : <><span>Let's go</span><ArrowRight size={14} /></>
              }
            </button>
          </form>

          {/* Footer */}
          <div style={{ marginTop: 28, borderTop: '0.5px solid #e8e4dc', paddingTop: 18, textAlign: 'center' }}>
            <p style={{ fontSize: 11, color: '#9a9690', margin: 0 }}>
              No access yet? Hit up{' '}
              <a
                href="mailto:admin@prefacewearhouse.com"
                style={{ color: MAROON, textDecoration: 'none' }}
              >
                admin@prefacewearhouse.com
              </a>
            </p>
          </div>

        </div>
      </div>
    </div>
  )
}
