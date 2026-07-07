import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { hrisApi } from '../../api'
import { useAuth } from '../../context/AuthContext'
import CameraCapture from '../../components/CameraCapture'
import { LogOut, MapPin, Loader2, Camera, Building2, Laptop, Briefcase, X } from 'lucide-react'

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
  const canViewAll = hasPermission('hris.attendance.edit') || hasPermission('hris.reports.view') || user?.role === 'SUPER_ADMIN' || user?.role === 'COMPANY_ADMIN'
  const [locating, setLocating] = useState(false)
  const [showModePicker, setShowModePicker] = useState(false)
  const [showCheckoutChoice, setShowCheckoutChoice] = useState(false)
  const [showFieldNote, setShowFieldNote] = useState(false)
  const [showCamera, setShowCamera] = useState(false)
  const [fieldNote, setFieldNote] = useState('')
  const pendingActionRef = useRef(null) // 'in' | 'out'
  const pendingModeRef = useRef('ON_SITE')
  const checkoutOverrideRef = useRef(false) // true saat checkout ganti mode ON_SITE -> FIELD

  const { data: today } = useQuery({ queryKey: ['hris-today'], queryFn: hrisApi.today })
  const { data: history, isLoading } = useQuery({
    queryKey: ['hris-attendance-list'],
    queryFn: () => hrisApi.attendanceList({ limit: 30 }),
  })

  const invalidate = () => { qc.invalidateQueries({ queryKey: ['hris-today'] }); qc.invalidateQueries({ queryKey: ['hris-attendance-list'] }) }

  const checkIn = useMutation({
    mutationFn: hrisApi.checkIn,
    onSuccess: () => { toast.success('Check-in berhasil'); invalidate() },
    onError: (e) => toast.error(e.response?.data?.message ?? 'Gagal check-in'),
  })
  const checkOut = useMutation({
    mutationFn: hrisApi.checkOut,
    onSuccess: () => { toast.success('Check-out berhasil'); invalidate() },
    onError: (e) => toast.error(e.response?.data?.message ?? 'Gagal check-out'),
  })

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
      <div className="mb-5">
        <h1 className="text-lg font-bold text-slate-800">Presensi</h1>
        <p className="text-xs text-slate-400 mt-0.5">Check-in dan check-out memerlukan izin lokasi (GPS) dan foto selfie untuk validasi</p>
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
            </p>
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
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={7} className="td py-8 text-center text-slate-400">Memuat…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={7} className="td py-8 text-center text-slate-400">Belum ada data presensi</td></tr>
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
                      {fmtTime(r.checkInAt)}
                    </div>
                  </td>
                  <td className="td">
                    <div className="flex items-center gap-2">
                      {r.checkOutPhoto && (
                        <a href={r.checkOutPhoto} target="_blank" rel="noreferrer">
                          <img src={r.checkOutPhoto} alt="Foto check-out" className="w-7 h-7 rounded-full object-cover border border-slate-200" />
                        </a>
                      )}
                      {fmtTime(r.checkOutAt)}
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
                  <td className="td text-center"><span className={STATUS_COLOR[r.status]}>{STATUS_LABEL[r.status]}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
