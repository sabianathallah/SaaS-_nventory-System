import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { hrisApi } from '../../../api'
import { useCompanyGuard } from '../../../hooks/useCompanyGuard'
import CompanyRequiredBanner from '../../../components/CompanyRequiredBanner'
import { Timer, AlarmClock, Medal } from 'lucide-react'

const fmtDur = (m) => {
  const h = Math.floor(m / 60), mm = m % 60
  return h && mm ? `${h} jam ${mm} menit` : h ? `${h} jam` : `${mm} menit`
}

// Semua nilai skor leaderboard yang bisa diatur. Rentang jam pada label
// mengikuti contoh shift 09:00 — aslinya dihitung relatif jam mulai shift.
const SCORE_FIELDS = [
  { key: 'scoreOnTime',       def: 100, label: 'Tepat waktu',        hint: 'datang ≤ jam mulai shift (mis. ≤ 09:00)' },
  { key: 'scoreLateTier1',    def: 90,  label: 'Telat 1–29 menit',   hint: 'mis. 09:01 – 09:29' },
  { key: 'scoreLateTier2',    def: 85,  label: 'Telat 30–45 menit',  hint: 'mis. 09:30 – 09:45' },
  { key: 'scoreLateTier3',    def: 80,  label: 'Telat 46–60 menit',  hint: 'mis. 09:46 – 10:00' },
  { key: 'scoreLateTier4',    def: 75,  label: 'Telat > 60 menit',   hint: 'mis. setelah 10:00' },
  { key: 'lateExcuseBonus',   def: 5,   label: 'Bonus izin telat',   hint: '+ poin di atas skor jam datang (maks total 100)' },
  { key: 'scoreHalfDay',      def: 50,  label: 'Setengah hari',      hint: 'status Half Day' },
  { key: 'fieldPendingScore', def: 75,  label: 'Lapangan belum direview', hint: 'skor sementara sampai admin review' },
]

export default function WorkPolicy() {
  const qc = useQueryClient()
  const { needsCompany } = useCompanyGuard()

  const { data: settings } = useQuery({ queryKey: ['hris-settings'], queryFn: hrisApi.hrisSettings })
  const [workHours, setWorkHours] = useState('8')
  const [workMinutes, setWorkMinutes] = useState('0')
  const [graceMinutes, setGraceMinutes] = useState('15')
  const [scores, setScores] = useState(() => Object.fromEntries(SCORE_FIELDS.map(f => [f.key, String(f.def)])))

  useEffect(() => {
    if (!settings) return
    setWorkHours(String(Math.floor(settings.minWorkMinutes / 60)))
    setWorkMinutes(String(settings.minWorkMinutes % 60))
    setGraceMinutes(String(settings.lateGraceMinutes))
    setScores(Object.fromEntries(SCORE_FIELDS.map(f => [f.key, String(settings[f.key] ?? f.def)])))
  }, [settings])

  const save = useMutation({
    mutationFn: hrisApi.updateHrisSettings,
    onSuccess: () => { toast.success('Aturan jam kerja disimpan'); qc.invalidateQueries({ queryKey: ['hris-settings'] }) },
    onError: (e) => toast.error(e.response?.data?.message ?? 'Gagal menyimpan'),
  })

  function submit(e) {
    e.preventDefault()
    const minWorkMinutes = Number(workHours || 0) * 60 + Number(workMinutes || 0)
    const lateGraceMinutes = Number(graceMinutes || 0)
    const scoreValues = Object.fromEntries(Object.entries(scores).map(([k, v]) => [k, Number(v || 0)]))
    save.mutate({ minWorkMinutes, lateGraceMinutes, ...scoreValues })
  }

  const previewWork = Number(workHours || 0) * 60 + Number(workMinutes || 0)

  return (
    <div className="px-6 py-6 max-w-2xl">
      {needsCompany && <div className="mb-4"><CompanyRequiredBanner action="mengatur jam kerja" /></div>}
      <div className="mb-5">
        <h1 className="text-lg font-bold text-slate-800">Aturan Jam Kerja</h1>
        <p className="text-xs text-slate-400 mt-0.5">
          Berlaku untuk semua karyawan di company ini. Perubahan langsung berlaku untuk presensi berikutnya.
        </p>
      </div>

      <form onSubmit={submit} className="space-y-4">
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-1">
            <Timer size={15} className="text-brand" />
            <p className="text-sm font-semibold text-slate-800">Durasi Kerja Minimal per Hari</p>
          </div>
          <p className="text-xs text-slate-400 mb-3 leading-relaxed">
            Dihitung dari jam check-in masing-masing karyawan (termasuk istirahat) — yang masuk siang otomatis pulang lebih sore.
            Check-out sebelum durasi terpenuhi tetap bisa, tapi wajib isi alasan dan masuk antrean review admin.
          </p>
          <div className="flex items-end gap-3">
            <div>
              <label className="label">Jam</label>
              <input type="number" min="0" max="24" className="input w-24" value={workHours} onChange={e => setWorkHours(e.target.value)} />
            </div>
            <div>
              <label className="label">Menit</label>
              <input type="number" min="0" max="59" className="input w-24" value={workMinutes} onChange={e => setWorkMinutes(e.target.value)} />
            </div>
            <p className="text-xs text-slate-400 pb-2">= {fmtDur(previewWork)} kerja minimal</p>
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-2 mb-1">
            <AlarmClock size={15} className="text-amber-500" />
            <p className="text-sm font-semibold text-slate-800">Toleransi Keterlambatan</p>
          </div>
          <p className="text-xs text-slate-400 mb-3 leading-relaxed">
            Check-in setelah jam mulai shift + toleransi ini akan tercatat sebagai Terlambat.
          </p>
          <div className="flex items-end gap-3">
            <div>
              <label className="label">Menit</label>
              <input type="number" min="0" max="1440" className="input w-24" value={graceMinutes} onChange={e => setGraceMinutes(e.target.value)} />
            </div>
            <p className="text-xs text-slate-400 pb-2">telat &gt; {graceMinutes || 0} menit dari jam shift = Terlambat</p>
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-2 mb-1">
            <Medal size={15} className="text-indigo-500" />
            <p className="text-sm font-semibold text-slate-800">Skor Kedisiplinan Leaderboard</p>
          </div>
          <p className="text-xs text-slate-400 mb-3 leading-relaxed">
            Poin per hari (0–100) untuk leaderboard kedisiplinan, dihitung dari jam datang relatif
            ke jam mulai shift masing-masing. Izin telat yang disetujui dapat bonus di atas skor
            jam datangnya — selalu lebih tinggi dari telat tanpa izin. Kerja lapangan yang disetujui
            &amp; sudah di vendor saat absen dihitung normal, yang belum sampai vendor poinnya diisi
            reviewer, ditolak = 0. Absen = 0, cuti/sakit tidak dihitung. Aturan ini tampil ke semua
            karyawan di halaman Presensi.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
            {SCORE_FIELDS.map(f => (
              <div key={f.key} className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm text-slate-700">{f.label}</p>
                  <p className="text-[11px] text-slate-400 truncate">{f.hint}</p>
                </div>
                <input type="number" min="0" max="100" className="input w-20 shrink-0" value={scores[f.key]}
                  onChange={e => setScores(s => ({ ...s, [f.key]: e.target.value }))} />
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end">
          <button type="submit" disabled={save.isPending || needsCompany} className="btn-primary text-sm">
            {save.isPending ? 'Menyimpan…' : 'Simpan Aturan'}
          </button>
        </div>
      </form>
    </div>
  )
}
