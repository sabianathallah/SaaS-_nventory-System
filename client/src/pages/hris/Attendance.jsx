import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { hrisApi } from '../../api'
import { useAuth } from '../../context/AuthContext'
import CameraCapture from '../../components/CameraCapture'
import { useCompanyGuard } from '../../hooks/useCompanyGuard'
import CompanyRequiredBanner from '../../components/CompanyRequiredBanner'
import { LogOut, MapPin, Loader2, Camera, Building2, Laptop, Briefcase, X, Pencil, Plus } from 'lucide-react'

const STATUS_LABEL = { PRESENT: 'Hadir', LATE: 'Terlambat', ABSENT: 'Absen', LEAVE: 'Cuti', HALF_DAY: 'Setengah Hari' }
const STATUS_COLOR = {
  PRESENT: 'badge-green', LATE: 'badge-amber', ABSENT: 'badge-red',
  LEAVE: 'badge-purple', HALF_DAY: 'badge-teal',
}
const MODE_LABEL = { ON_SITE: 'On-site', WFA: 'WFA', FIELD: 'Lapangan' }
const MODE_COLOR = { ON_SITE: 'badge-muted', WFA: 'badge-indigo', FIELD: 'badge-teal' }
const REVIEW_LABEL = { PENDING_REVIEW: 'Menunggu Persetujuan', APPROVED: 'Disetujui', REJECTED: 'Tidak Disetujui' }
const REVIEW_COLOR = { PENDING_REVIEW: 'badge-amber', APPROVED: 'badge-green', REJECTED: 'badge-red' }

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
const fmtTime = (d) => d ? new Date(d).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '—'
const mapsLink = (lat, lng) => `https://www.google.com/maps?q=${lat},${lng}`

// Nama lokasi kantor kalau ON_SITE, atau link ke Google Maps pakai koordinat
// GPS asli untuk WFA/Kerja Lapangan (gak ada lokasi kantor yang cocok).
function LocationTag({ location, lat, lng }) {
  if (location) {
    return (
      <a
        href={mapsLink(location.latitude, location.longitude)}
        target="_blank" rel="noreferrer"
        className="inline-flex items-center gap-1 text-[10px] text-slate-400 hover:text-brand mt-0.5"
        title="Lihat di Google Maps"
      >
        <MapPin size={10} /> {location.name}
      </a>
    )
  }
  if (lat && lng) {
    return (
      <a
        href={mapsLink(lat, lng)}
        target="_blank" rel="noreferrer"
        className="inline-flex items-center gap-1 text-[10px] text-slate-400 hover:text-brand mt-0.5"
        title="Lihat di Google Maps"
      >
        <MapPin size={10} /> Lihat lokasi
      </a>
    )
  }
  return null
}

function toDatetimeLocal(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
function fromDatetimeLocal(value) {
  if (!value) return null
  return new Date(value).toISOString()
}

const EDIT_MODES = [
  { value: 'ON_SITE', label: 'On-site' },
  { value: 'WFA', label: 'WFA' },
  { value: 'FIELD', label: 'Kerja Lapangan' },
]
const STATUS_OPTIONS = Object.entries(STATUS_LABEL)
const EMPTY_EDIT_FORM = { status: 'PRESENT', workMode: 'ON_SITE', checkInAt: '', checkOutAt: '', note: '', editReason: '' }

function getLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('Geolocation tidak didukung browser ini'))
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => reject(new Error(err.message || 'Gagal mengambil lokasi')),
      { enableHighAccuracy: true, timeout: 10000 }
    )
  })
}

const CHECKIN_MODES = [
  { value: 'ON_SITE', label: 'On-site', desc: 'Bekerja dari kantor', icon: Building2 },
  { value: 'WFA', label: 'WFA', desc: 'Butuh pengajuan yang sudah disetujui', icon: Laptop },
  { value: 'FIELD', label: 'Kerja Lapangan', desc: 'Kunjungan vendor / kerja di luar kantor', icon: Briefcase },
]

export default function Attendance() {
  const { hasPermission, user } = useAuth()
  const qc = useQueryClient()
  const canEdit = hasPermission('hris.attendance.edit') || user?.role === 'SUPER_ADMIN' || user?.role === 'COMPANY_ADMIN'
  const canViewAll = canEdit || hasPermission('hris.reports.view')
  const { needsCompany } = useCompanyGuard()
  const [locating, setLocating] = useState(false)
  const [showModePicker, setShowModePicker] = useState(false)
  const [showCheckoutChoice, setShowCheckoutChoice] = useState(false)
  const [showFieldNote, setShowFieldNote] = useState(false)
  const [showCamera, setShowCamera] = useState(false)
  const [fieldNote, setFieldNote] = useState('')
  const pendingActionRef = useRef(null) // 'in' | 'out'
  const pendingModeRef = useRef('ON_SITE')
  const checkoutOverrideRef = useRef(false) // true saat checkout ganti mode ON_SITE -> FIELD

  const [editingRow, setEditingRow] = useState(null) // attendance row lagi diedit, atau null
  const [editForm, setEditForm] = useState(EMPTY_EDIT_FORM)
  const [showCreate, setShowCreate] = useState(false)
  const [createForm, setCreateForm] = useState({ ...EMPTY_EDIT_FORM, userId: '', date: '' })
  const [latePrompt, setLatePrompt] = useState(null) // { id, checkInAt } atau null
  const [lateReasonInput, setLateReasonInput] = useState('')

  const { data: today } = useQuery({ queryKey: ['hris-today'], queryFn: hrisApi.today })
  const { data: history, isLoading } = useQuery({
    queryKey: ['hris-attendance-list'],
    queryFn: () => hrisApi.attendanceList({ limit: 30 }),
  })
  const { data: companyUsers } = useQuery({
    queryKey: ['hris-attendance-users'],
    queryFn: hrisApi.attendanceUsers,
    enabled: canEdit,
  })
  const { data: leaderboard } = useQuery({ queryKey: ['hris-attendance-leaderboard'], queryFn: () => hrisApi.leaderboard({}) })

  const invalidate = () => { qc.invalidateQueries({ queryKey: ['hris-today'] }); qc.invalidateQueries({ queryKey: ['hris-attendance-list'] }) }

  const checkIn = useMutation({
    mutationFn: hrisApi.checkIn,
    onSuccess: (data) => {
      toast.success('Check-in berhasil')
      invalidate()
      if (data.status === 'LATE' && data.lateExcuseStatus === 'NONE') {
        setLatePrompt({ id: data.id, checkInAt: data.checkInAt })
      }
    },
    onError: (e) => toast.error(e.response?.data?.message ?? 'Gagal check-in'),
  })
  const submitLateReason = useMutation({
    mutationFn: ({ id, reason }) => hrisApi.submitLateReason(id, { reason }),
    onSuccess: () => { toast.success('Alasan terkirim, menunggu review'); setLatePrompt(null); setLateReasonInput(''); invalidate() },
    onError: (e) => toast.error(e.response?.data?.message ?? 'Gagal mengirim alasan'),
  })
  const checkOut = useMutation({
    mutationFn: hrisApi.checkOut,
    onSuccess: () => { toast.success('Check-out berhasil'); invalidate() },
    onError: (e) => toast.error(e.response?.data?.message ?? 'Gagal check-out'),
  })
  const editAttendance = useMutation({
    mutationFn: ({ id, data }) => hrisApi.updateAttendance(id, data),
    onSuccess: () => { toast.success('Presensi diperbarui'); setEditingRow(null); invalidate() },
    onError: (e) => toast.error(e.response?.data?.message ?? 'Gagal memperbarui presensi'),
  })
  const createAttendance = useMutation({
    mutationFn: hrisApi.createAttendanceManual,
    onSuccess: () => { toast.success('Presensi manual ditambahkan'); setShowCreate(false); setCreateForm({ ...EMPTY_EDIT_FORM, userId: '', date: '' }); invalidate() },
    onError: (e) => toast.error(e.response?.data?.message ?? 'Gagal menambahkan presensi'),
  })

  function openEdit(row) {
    setEditingRow(row)
    setEditForm({
      status: row.status,
      workMode: row.workMode,
      checkInAt: toDatetimeLocal(row.checkInAt),
      checkOutAt: toDatetimeLocal(row.checkOutAt),
      note: row.note || '',
      editReason: '',
    })
  }

  function submitEdit(e) {
    e.preventDefault()
    if (!editForm.editReason.trim()) return toast.error('Alasan koreksi wajib diisi')
    editAttendance.mutate({
      id: editingRow.id,
      data: {
        status: editForm.status,
        workMode: editForm.workMode,
        checkInAt: fromDatetimeLocal(editForm.checkInAt),
        checkOutAt: fromDatetimeLocal(editForm.checkOutAt),
        note: editForm.note || null,
        editReason: editForm.editReason.trim(),
      },
    })
  }

  function submitCreate(e) {
    e.preventDefault()
    if (!createForm.userId || !createForm.date) return toast.error('Pengguna dan tanggal wajib diisi')
    if (!createForm.editReason.trim()) return toast.error('Alasan wajib diisi')
    createAttendance.mutate({
      userId: createForm.userId,
      date: createForm.date,
      status: createForm.status,
      workMode: createForm.workMode,
      checkInAt: fromDatetimeLocal(createForm.checkInAt),
      checkOutAt: fromDatetimeLocal(createForm.checkOutAt),
      note: createForm.note || null,
      editReason: createForm.editReason.trim(),
    })
  }

  function startCheckIn() {
    setShowModePicker(true)
  }
  function startCheckOut() {
    pendingActionRef.current = 'out'
    checkoutOverrideRef.current = false
    // Cuma tawarkan pindah ke Kerja Lapangan kalau check-in-nya On-site —
    // kombinasi lain (WFA/FIELD) tetap ikut mode yang sama seperti sekarang.
    if (today?.workMode === 'ON_SITE') {
      setShowCheckoutChoice(true)
    } else {
      setShowCamera(true)
    }
  }

  function pickMode(mode) {
    pendingModeRef.current = mode
    pendingActionRef.current = 'in'
    setShowModePicker(false)
    if (mode === 'FIELD') {
      setShowFieldNote(true)
    } else {
      setShowCamera(true)
    }
  }

  function pickCheckoutMode(mode) {
    setShowCheckoutChoice(false)
    if (mode === 'FIELD') {
      checkoutOverrideRef.current = true
      setShowFieldNote(true)
    } else {
      setShowCamera(true)
    }
  }

  function confirmFieldNote() {
    if (!fieldNote.trim()) return toast.error('Catatan tujuan wajib diisi')
    setShowFieldNote(false)
    setShowCamera(true)
  }

  async function handlePhotoCaptured(photo) {
    setShowCamera(false)
    const action = pendingActionRef.current
    setLocating(true)
    try {
      const { lat, lng } = await getLocation()
      if (action === 'in') {
        checkIn.mutate({ lat, lng, photo, workMode: pendingModeRef.current, note: pendingModeRef.current === 'FIELD' ? fieldNote.trim() : undefined })
        setFieldNote('')
      } else if (checkoutOverrideRef.current) {
        checkOut.mutate({ lat, lng, photo, workMode: 'FIELD', note: fieldNote.trim() })
        setFieldNote('')
        checkoutOverrideRef.current = false
      } else {
        checkOut.mutate({ lat, lng, photo })
      }
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLocating(false)
    }
  }

  const rows = history?.data ?? []
  const busy = locating || checkIn.isPending || checkOut.isPending

  return (
    <div className="px-6 py-6 max-w-5xl">
      {needsCompany && <div className="mb-4"><CompanyRequiredBanner action="melakukan presensi" /></div>}
      <div className="mb-5 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-bold text-slate-800">Presensi</h1>
          <p className="text-xs text-slate-400 mt-0.5">Check-in dan check-out memerlukan izin lokasi (GPS) dan foto selfie untuk validasi</p>
        </div>
        {canEdit && (
          <button onClick={() => setShowCreate(true)} className="btn-secondary text-sm flex items-center gap-1.5">
            <Plus size={14} /> Tambah Presensi Manual
          </button>
        )}
      </div>

      <div className="card p-5 mb-6 flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center text-brand">
            <MapPin size={18} />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800">Hari ini, {fmtDate(new Date())}</p>
            <p className="text-xs text-slate-500 mt-0.5">
              {today?.checkInAt ? `Check-in ${fmtTime(today.checkInAt)}` : 'Belum check-in'}
              {today?.checkOutAt && ` · Check-out ${fmtTime(today.checkOutAt)}`}
              {today?.workMode && today.workMode !== 'ON_SITE' && (
                <span className={`ml-2 ${MODE_COLOR[today.workMode]}`}>{MODE_LABEL[today.workMode]}</span>
              )}
              {today?.reviewStatus && today.reviewStatus !== 'NONE' && (
                <span className={`ml-2 ${REVIEW_COLOR[today.reviewStatus]}`}>{REVIEW_LABEL[today.reviewStatus]}</span>
              )}
              {today?.lateExcuseStatus && today.lateExcuseStatus !== 'NONE' && (
                <span className={`ml-2 ${REVIEW_COLOR[today.lateExcuseStatus]}`}>Telat: {REVIEW_LABEL[today.lateExcuseStatus]}</span>
              )}
            </p>
            <div className="flex items-center gap-3 mt-0.5">
              {today?.checkInAt && <LocationTag location={today.checkInLocation} lat={today.checkInLat} lng={today.checkInLng} />}
              {today?.checkOutAt && <LocationTag location={today.checkOutLocation} lat={today.checkOutLat} lng={today.checkOutLng} />}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          {!today?.checkInAt && (
            <button onClick={startCheckIn} disabled={busy} className="btn-primary text-sm">
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />} Check-in
            </button>
          )}
          {today?.checkInAt && !today?.checkOutAt && (
            <button onClick={startCheckOut} disabled={busy} className="btn-primary text-sm">
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />} Check-out
            </button>
          )}
          {today?.checkInAt && today?.checkOutAt && (
            <span className="badge-green">Presensi hari ini selesai</span>
          )}
        </div>
      </div>

      {(leaderboard?.mostOnTime?.length > 0 || leaderboard?.mostLate?.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {leaderboard?.mostOnTime?.length > 0 && (
            <div className="card p-4">
              <p className="text-sm font-semibold text-slate-800 mb-3">🏆 Paling Tepat Waktu Bulan Ini</p>
              <div className="space-y-2">
                {leaderboard.mostOnTime.map((u, i) => (
                  <div key={u.userId} className="flex items-center gap-3">
                    <span className="w-5 text-xs font-semibold text-slate-400 text-center">{i + 1}</span>
                    <span className="flex-1 text-sm text-slate-700">{u.name}</span>
                    <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
                      {u.presentCount}x hadir
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {leaderboard?.mostLate?.length > 0 && (
            <div className="card p-4">
              <p className="text-sm font-semibold text-slate-800 mb-3">⏰ Paling Sering Terlambat Bulan Ini</p>
              <div className="space-y-2">
                {leaderboard.mostLate.map((u, i) => (
                  <div key={u.userId} className="flex items-center gap-3">
                    <span className="w-5 text-xs font-semibold text-slate-400 text-center">{i + 1}</span>
                    <span className="flex-1 text-sm text-slate-700">{u.name}</span>
                    <span className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
                      {u.lateCount}x terlambat
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {showModePicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4" onClick={() => setShowModePicker(false)}>
          <div className="card w-full max-w-sm p-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-semibold text-slate-800">Pilih Cara Absen</p>
              <button onClick={() => setShowModePicker(false)} className="text-slate-400 hover:text-slate-600"><X size={16} /></button>
            </div>
            <div className="space-y-2">
              {CHECKIN_MODES.map(({ value, label, desc, icon: Icon }) => (
                <button
                  key={value}
                  onClick={() => pickMode(value)}
                  className="w-full flex items-center gap-3 p-3 rounded-lg border border-slate-200 hover:border-brand hover:bg-brand-50 transition-colors text-left"
                >
                  <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600 flex-shrink-0">
                    <Icon size={16} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-800">{label}</p>
                    <p className="text-xs text-slate-400">{desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {showCheckoutChoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4" onClick={() => setShowCheckoutChoice(false)}>
          <div className="card w-full max-w-sm p-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-semibold text-slate-800">Check-out dari Mana?</p>
              <button onClick={() => setShowCheckoutChoice(false)} className="text-slate-400 hover:text-slate-600"><X size={16} /></button>
            </div>
            <div className="space-y-2">
              <button
                onClick={() => pickCheckoutMode('ON_SITE')}
                className="w-full flex items-center gap-3 p-3 rounded-lg border border-slate-200 hover:border-brand hover:bg-brand-50 transition-colors text-left"
              >
                <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600 flex-shrink-0">
                  <Building2 size={16} />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-800">Masih di Kantor</p>
                  <p className="text-xs text-slate-400">Check-out normal, validasi lokasi kantor</p>
                </div>
              </button>
              <button
                onClick={() => pickCheckoutMode('FIELD')}
                className="w-full flex items-center gap-3 p-3 rounded-lg border border-slate-200 hover:border-brand hover:bg-brand-50 transition-colors text-left"
              >
                <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600 flex-shrink-0">
                  <Briefcase size={16} />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-800">Kerja Lapangan</p>
                  <p className="text-xs text-slate-400">Sudah tidak di kantor (mis. kunjungan vendor). Butuh persetujuan admin.</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {showFieldNote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4" onClick={() => setShowFieldNote(false)}>
          <div className="card w-full max-w-sm p-5" onClick={e => e.stopPropagation()}>
            <p className="text-sm font-semibold text-slate-800 mb-1">Catatan Tujuan</p>
            <p className="text-xs text-slate-400 mb-3">Wajib diisi untuk kerja lapangan, misal: "Kunjungan ke Vendor ABC"</p>
            <textarea autoFocus className="input mb-3" rows={3} value={fieldNote} onChange={e => setFieldNote(e.target.value)} />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowFieldNote(false)} className="btn-secondary text-sm">Batal</button>
              <button onClick={confirmFieldNote} className="btn-primary text-sm">Lanjutkan</button>
            </div>
          </div>
        </div>
      )}

      {showCamera && (
        <CameraCapture onCapture={handlePhotoCaptured} onClose={() => setShowCamera(false)} />
      )}

      {latePrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4" onClick={() => setLatePrompt(null)}>
          <div className="card w-full max-w-sm p-5" onClick={e => e.stopPropagation()}>
            <p className="text-sm font-semibold text-slate-800 mb-1">Anda Tercatat Terlambat</p>
            <p className="text-xs text-slate-400 mb-3">
              Check-in pukul {fmtTime(latePrompt.checkInAt)}. Kalau ada alasan (mis. ada urusan), isi di sini biar bisa direview admin — kalau disetujui, gak dianggap terlambat.
            </p>
            <textarea autoFocus className="input mb-3" rows={3} placeholder="mis. Ada urusan keluarga pagi ini" value={lateReasonInput} onChange={e => setLateReasonInput(e.target.value)} />
            <div className="flex justify-end gap-2">
              <button onClick={() => { setLatePrompt(null); setLateReasonInput('') }} className="btn-secondary text-sm">Lewati</button>
              <button
                onClick={() => { if (!lateReasonInput.trim()) return toast.error('Isi alasannya dulu'); submitLateReason.mutate({ id: latePrompt.id, reason: lateReasonInput.trim() }) }}
                disabled={submitLateReason.isPending}
                className="btn-primary text-sm"
              >
                {submitLateReason.isPending ? 'Mengirim…' : 'Kirim Alasan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {editingRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4" onClick={() => setEditingRow(null)}>
          <form onSubmit={submitEdit} className="card w-full max-w-md p-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm font-semibold text-slate-800">Edit Presensi</p>
                <p className="text-xs text-slate-400">{editingRow.user?.name ?? 'Saya'} · {fmtDate(editingRow.date)}</p>
              </div>
              <button type="button" onClick={() => setEditingRow(null)} className="text-slate-400 hover:text-slate-600"><X size={16} /></button>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="label">Check-in</label>
                <input type="datetime-local" className="input" value={editForm.checkInAt} onChange={e => setEditForm(f => ({ ...f, checkInAt: e.target.value }))} />
              </div>
              <div>
                <label className="label">Check-out</label>
                <input type="datetime-local" className="input" value={editForm.checkOutAt} onChange={e => setEditForm(f => ({ ...f, checkOutAt: e.target.value }))} />
              </div>
              <div>
                <label className="label">Status</label>
                <select className="input" value={editForm.status} onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))}>
                  {STATUS_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Mode</label>
                <select className="input" value={editForm.workMode} onChange={e => setEditForm(f => ({ ...f, workMode: e.target.value }))}>
                  {EDIT_MODES.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
                </select>
              </div>
            </div>
            <label className="label">Catatan</label>
            <textarea className="input mb-3" rows={2} value={editForm.note} onChange={e => setEditForm(f => ({ ...f, note: e.target.value }))} />
            <label className="label">Alasan Koreksi (wajib)</label>
            <textarea required autoFocus={false} className="input mb-4" rows={2} placeholder="mis. Lupa check-out, dikoreksi sesuai laporan atasan" value={editForm.editReason} onChange={e => setEditForm(f => ({ ...f, editReason: e.target.value }))} />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setEditingRow(null)} className="btn-secondary text-sm">Batal</button>
              <button type="submit" disabled={editAttendance.isPending} className="btn-primary text-sm">
                {editAttendance.isPending ? 'Menyimpan…' : 'Simpan'}
              </button>
            </div>
          </form>
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4" onClick={() => setShowCreate(false)}>
          <form onSubmit={submitCreate} className="card w-full max-w-md p-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-semibold text-slate-800">Tambah Presensi Manual</p>
              <button type="button" onClick={() => setShowCreate(false)} className="text-slate-400 hover:text-slate-600"><X size={16} /></button>
            </div>
            <p className="text-xs text-slate-400 mb-3">Untuk kasus lupa absen — belum ada data presensi sama sekali di tanggal ini.</p>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div className="col-span-2">
                <label className="label">Pengguna</label>
                <select required className="input" value={createForm.userId} onChange={e => setCreateForm(f => ({ ...f, userId: e.target.value }))}>
                  <option value="">Pilih pengguna…</option>
                  {(companyUsers ?? []).map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label className="label">Tanggal</label>
                <input type="date" required className="input" value={createForm.date} onChange={e => setCreateForm(f => ({ ...f, date: e.target.value }))} />
              </div>
              <div>
                <label className="label">Check-in</label>
                <input type="datetime-local" className="input" value={createForm.checkInAt} onChange={e => setCreateForm(f => ({ ...f, checkInAt: e.target.value }))} />
              </div>
              <div>
                <label className="label">Check-out</label>
                <input type="datetime-local" className="input" value={createForm.checkOutAt} onChange={e => setCreateForm(f => ({ ...f, checkOutAt: e.target.value }))} />
              </div>
              <div>
                <label className="label">Status</label>
                <select className="input" value={createForm.status} onChange={e => setCreateForm(f => ({ ...f, status: e.target.value }))}>
                  {STATUS_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Mode</label>
                <select className="input" value={createForm.workMode} onChange={e => setCreateForm(f => ({ ...f, workMode: e.target.value }))}>
                  {EDIT_MODES.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
                </select>
              </div>
            </div>
            <label className="label">Catatan</label>
            <textarea className="input mb-3" rows={2} value={createForm.note} onChange={e => setCreateForm(f => ({ ...f, note: e.target.value }))} />
            <label className="label">Alasan (wajib)</label>
            <textarea required className="input mb-4" rows={2} placeholder="mis. Lupa absen, dikonfirmasi lewat WA ke atasan" value={createForm.editReason} onChange={e => setCreateForm(f => ({ ...f, editReason: e.target.value }))} />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowCreate(false)} className="btn-secondary text-sm">Batal</button>
              <button type="submit" disabled={createAttendance.isPending} className="btn-primary text-sm">
                {createAttendance.isPending ? 'Menyimpan…' : 'Simpan'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100">
          <p className="text-sm font-semibold text-slate-700">Riwayat Presensi</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="th">Tanggal</th>
                {canViewAll && <th className="th">Nama</th>}
                <th className="th">Check-in</th>
                <th className="th">Check-out</th>
                <th className="th">Mode</th>
                <th className="th">Shift</th>
                <th className="th text-center">Status</th>
                {canEdit && <th className="th text-center">Aksi</th>}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={8} className="td py-8 text-center text-slate-400">Memuat…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={8} className="td py-8 text-center text-slate-400">Belum ada data presensi</td></tr>
              ) : rows.map(r => (
                <tr key={r.id} className="tr">
                  <td className="td">{fmtDate(r.date)}</td>
                  {canViewAll && <td className="td">{r.user?.name ?? '—'}</td>}
                  <td className="td">
                    <div className="flex items-center gap-2">
                      {r.checkInPhoto && (
                        <a href={r.checkInPhoto} target="_blank" rel="noreferrer">
                          <img src={r.checkInPhoto} alt="Foto check-in" className="w-7 h-7 rounded-full object-cover border border-slate-200" />
                        </a>
                      )}
                      <div>
                        {fmtTime(r.checkInAt)}
                        <LocationTag location={r.checkInLocation} lat={r.checkInLat} lng={r.checkInLng} />
                      </div>
                    </div>
                  </td>
                  <td className="td">
                    <div className="flex items-center gap-2">
                      {r.checkOutPhoto && (
                        <a href={r.checkOutPhoto} target="_blank" rel="noreferrer">
                          <img src={r.checkOutPhoto} alt="Foto check-out" className="w-7 h-7 rounded-full object-cover border border-slate-200" />
                        </a>
                      )}
                      <div>
                        {fmtTime(r.checkOutAt)}
                        <LocationTag location={r.checkOutLocation} lat={r.checkOutLat} lng={r.checkOutLng} />
                      </div>
                    </div>
                  </td>
                  <td className="td">
                    <div className="flex items-center gap-1 flex-wrap">
                      <span className={MODE_COLOR[r.workMode] ?? 'badge-muted'}>{MODE_LABEL[r.workMode] ?? '—'}</span>
                      {r.checkOutWorkMode === 'FIELD' && <span className={MODE_COLOR.FIELD}>Checkout Lapangan</span>}
                      {r.reviewStatus && r.reviewStatus !== 'NONE' && (
                        <span className={REVIEW_COLOR[r.reviewStatus]}>{REVIEW_LABEL[r.reviewStatus]}</span>
                      )}
                    </div>
                    {(r.workMode === 'FIELD' || r.checkOutWorkMode === 'FIELD') && r.note && (
                      <div className="text-[10px] text-slate-400 mt-0.5 max-w-[140px] truncate">{r.note}</div>
                    )}
                  </td>
                  <td className="td">{r.shift?.name ?? '—'}</td>
                  <td className="td text-center">
                    <span className={STATUS_COLOR[r.status]}>{STATUS_LABEL[r.status]}</span>
                    {r.lateExcuseStatus && r.lateExcuseStatus !== 'NONE' && (
                      <div className={`mt-1 ${REVIEW_COLOR[r.lateExcuseStatus]}`}>Telat: {REVIEW_LABEL[r.lateExcuseStatus]}</div>
                    )}
                  </td>
                  {canEdit && (
                    <td className="td text-center">
                      <button title="Edit presensi" onClick={() => openEdit(r)} className="w-7 h-7 rounded flex items-center justify-center text-slate-500 hover:bg-slate-100 mx-auto">
                        <Pencil size={14} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
