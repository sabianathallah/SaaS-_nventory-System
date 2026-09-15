import { useState, useRef } from 'react'
import { useMutation } from '@tanstack/react-query'
import { profileApi } from '../api'
import { useAuth } from '../context/AuthContext'
import { Camera, X, Eye, EyeOff, Save, Trash2 } from 'lucide-react'

export default function ProfileModal({ onClose }) {
  const { user, signIn } = useAuth()
  const fileRef = useRef()

  const [name, setName]           = useState(user?.name ?? '')
  const [avatarFile, setAvatarFile] = useState(null)
  const [avatarPreview, setAvatarPreview] = useState(user?.avatar ?? null)
  const [tab, setTab]             = useState('profile') // 'profile' | 'password'

  const [curPwd, setCurPwd]       = useState('')
  const [newPwd, setNewPwd]       = useState('')
  const [showCur, setShowCur]     = useState(false)
  const [showNew, setShowNew]     = useState(false)
  const [pwdMsg, setPwdMsg]       = useState(null)

  const updateMut = useMutation({
    mutationFn: () => profileApi.update({ name, avatar: avatarFile || undefined }),
    onSuccess: (updated) => {
      // Patch localStorage user so sidebar/topbar updates immediately
      const stored = JSON.parse(localStorage.getItem('user') || '{}')
      const patched = { ...stored, name: updated.name, avatar: updated.avatar }
      localStorage.setItem('user', JSON.stringify(patched))
      window.location.reload() // simplest way to sync all components
    },
  })

  const deleteAvatarMut = useMutation({
    mutationFn: profileApi.deleteAvatar,
    onSuccess: () => {
      const stored = JSON.parse(localStorage.getItem('user') || '{}')
      localStorage.setItem('user', JSON.stringify({ ...stored, avatar: null }))
      window.location.reload()
    },
  })

  const pwdMut = useMutation({
    mutationFn: () => profileApi.changePassword(curPwd, newPwd),
    onSuccess: (res) => {
      setPwdMsg({ type: 'success', text: res.message ?? 'Password berhasil diubah' })
      setCurPwd(''); setNewPwd('')
    },
    onError: (err) => {
      setPwdMsg({ type: 'error', text: err?.response?.data?.message ?? 'Gagal mengubah password' })
    },
  })

  function handleFileChange(e) {
    const file = e.target.files[0]
    if (!file) return
    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
  }

  const initials = (user?.name ?? 'U').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 className="text-sm font-bold text-slate-800">Profil Saya</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={16} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-100">
          {['profile', 'password'].map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2.5 text-xs font-semibold transition-colors ${
                tab === t ? 'text-red-600 border-b-2 border-red-600' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              {t === 'profile' ? 'Edit Profil' : 'Ganti Password'}
            </button>
          ))}
        </div>

        {tab === 'profile' && (
          <div className="p-5 space-y-5">
            {/* Avatar */}
            <div className="flex flex-col items-center gap-3">
              <div className="relative">
                {avatarPreview
                  ? <img src={avatarPreview} alt="avatar" className="w-20 h-20 rounded-full object-cover border-2 border-slate-200" />
                  : (
                    <div className="w-20 h-20 rounded-full flex items-center justify-center text-white text-xl font-bold" style={{ background: '#C8102E' }}>
                      {initials}
                    </div>
                  )
                }
                <button
                  onClick={() => fileRef.current.click()}
                  className="absolute bottom-0 right-0 w-6 h-6 rounded-full bg-slate-700 text-white flex items-center justify-center hover:bg-slate-900 transition-colors"
                >
                  <Camera size={11} />
                </button>
              </div>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
              {(avatarPreview && (user?.avatar || avatarFile)) && (
                <button
                  onClick={() => { setAvatarFile(null); setAvatarPreview(null) }}
                  className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1"
                >
                  <Trash2 size={10} /> Hapus foto
                </button>
              )}
            </div>

            {/* Name */}
            <div>
              <label className="label">Nama</label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                className="input text-sm w-full"
                placeholder="Nama lengkap"
              />
            </div>

            {/* Email (read-only) */}
            <div>
              <label className="label">Email</label>
              <input value={user?.email ?? ''} disabled className="input text-sm w-full opacity-50 cursor-not-allowed" />
            </div>

            <div className="flex gap-2 justify-end">
              {user?.avatar && !avatarFile && (
                <button
                  onClick={() => deleteAvatarMut.mutate()}
                  disabled={deleteAvatarMut.isPending}
                  className="btn-secondary text-xs text-red-500 hover:text-red-700"
                >
                  Hapus Foto
                </button>
              )}
              <button
                onClick={() => updateMut.mutate()}
                disabled={updateMut.isPending || !name.trim()}
                className="btn-primary text-xs flex items-center gap-1.5 disabled:opacity-50"
              >
                <Save size={12} />
                {updateMut.isPending ? 'Menyimpan…' : 'Simpan'}
              </button>
            </div>
            {updateMut.isError && (
              <p className="text-xs text-red-500">{updateMut.error?.response?.data?.message ?? 'Gagal menyimpan'}</p>
            )}
          </div>
        )}

        {tab === 'password' && (
          <div className="p-5 space-y-4">
            <div>
              <label className="label">Password Lama</label>
              <div className="relative">
                <input
                  type={showCur ? 'text' : 'password'}
                  value={curPwd}
                  onChange={e => { setCurPwd(e.target.value); setPwdMsg(null) }}
                  className="input text-sm w-full pr-9"
                  placeholder="Password saat ini"
                />
                <button
                  type="button"
                  onClick={() => setShowCur(v => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showCur ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
            <div>
              <label className="label">Password Baru</label>
              <div className="relative">
                <input
                  type={showNew ? 'text' : 'password'}
                  value={newPwd}
                  onChange={e => { setNewPwd(e.target.value); setPwdMsg(null) }}
                  className="input text-sm w-full pr-9"
                  placeholder="Minimal 6 karakter"
                />
                <button
                  type="button"
                  onClick={() => setShowNew(v => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showNew ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            {pwdMsg && (
              <p className={`text-xs ${pwdMsg.type === 'success' ? 'text-emerald-600' : 'text-red-500'}`}>
                {pwdMsg.text}
              </p>
            )}

            <div className="flex justify-end">
              <button
                onClick={() => pwdMut.mutate()}
                disabled={pwdMut.isPending || !curPwd || newPwd.length < 6}
                className="btn-primary text-xs flex items-center gap-1.5 disabled:opacity-50"
              >
                <Save size={12} />
                {pwdMut.isPending ? 'Menyimpan…' : 'Simpan Password'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
