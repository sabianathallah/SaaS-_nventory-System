import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { hrisApi } from '../../../api'
import { useCompanyGuard } from '../../../hooks/useCompanyGuard'
import CompanyRequiredBanner from '../../../components/CompanyRequiredBanner'
import { Timer, AlarmClock, Medal, Hourglass, Trophy, History } from 'lucide-react'

const MAX_SCORE = 200

const fmtDur = (m) => {
  const h = Math.floor(m / 60), mm = m % 60
  return h && mm ? `${h} jam ${mm} menit` : h ? `${h} jam` : `${mm} menit`
}
const fmtLogTime = (d) => new Date(d).toLocaleString('id-ID', {
  day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
})

// Skor jam datang. `maxKey` = batas menit telat tier itu (juga bisa diatur);
// tier terakhir tanpa batas. Rentang label dirakit dari batas tier sebelumnya.
const ARRIVAL_FIELDS = [
  { key: 'scoreOnTime',    def: 100, label: 'Tepat waktu', hint: 'datang ≤ jam mulai shift' },
  { key: 'scoreLateTier1', def: 90,  maxKey: 'lateTier1Max', maxDef: 29 },
  { key: 'scoreLateTier2', def: 85,  maxKey: 'lateTier2Max', maxDef: 45 },
  { key: 'scoreLateTier3', def: 80,  maxKey: 'lateTier3Max', maxDef: 60 },
  { key: 'scoreLateTier4', def: 75,  label: 'Telat lebih dari itu', hint: 'di atas batas tier terakhir' },
]

const EXTRA_FIELDS = [
  { key: 'lateExcuseBonus',   def: 5,  label: 'Bonus izin telat',   hint: '+ poin di atas skor jam datang (maks = poin tepat waktu)' },
  { key: 'scoreHalfDay',      def: 50, label: 'Setengah hari',      hint: 'status Half Day, tidak dicampur durasi' },
  { key: 'fieldPendingScore', def: 75, label: 'Lapangan belum direview', hint: 'skor sementara sampai admin review' },
]

// Skor lama jam kerja, dihitung dari selisih menit vs target durasi hari itu.
const WORK_FIELDS = [
  { key: 'scoreWorkOvertime', def: 100, maxKey: 'workOvertimeMinMinutes', maxDef: 60, overtime: true },
  { key: 'scoreWorkFull',     def: 100, label: 'Durasi kerja penuh', hint: 'kerja ≥ target, belum sampai ambang lembur' },
  { key: 'scoreWorkTier1',    def: 90,  maxKey: 'workShortTier1Max', maxDef: 29 },
  { key: 'scoreWorkTier2',    def: 80,  maxKey: 'workShortTier2Max', maxDef: 60 },
  { key: 'scoreWorkTier3',    def: 70,  label: 'Kurang lebih dari itu', hint: 'di atas batas tier terakhir; juga dipakai untuk yang lupa check-out' },
]

const ALL_FIELDS = [
  ...ARRIVAL_FIELDS, ...EXTRA_FIELDS, ...WORK_FIELDS,
  { key: 'workDurationWeight', def: 0 }, { key: 'leaderboardMinDays', def: 10 },
]
const THRESHOLD_FIELDS = [...ARRIVAL_FIELDS, ...WORK_FIELDS].filter(f => f.maxKey)

// Rentang tier kekurangan/keterlambatan ke-i, mis. "Telat 30–45 menit".
// Tier lembur dibaca terbalik: "Lembur ≥ N menit".
function tierLabel(fields, i, limits, prefix) {
  const field = fields[i]
  if (field.overtime) return `Lembur ≥ ${limits[field.maxKey] || 0} menit`
  const prev = fields[i - 1]
  const from = prev?.maxKey && !prev.overtime ? Number(limits[prev.maxKey] || 0) + 1 : 1
  return `${prefix} ${from}–${limits[field.maxKey] || 0} menit`
}

export default function WorkPolicy() {
  const qc = useQueryClient()
  const { needsCompany } = useCompanyGuard()

  const { data: settings } = useQuery({ queryKey: ['hris-settings'], queryFn: hrisApi.hrisSettings })
  const { data: logs } = useQuery({ queryKey: ['hris-setting-logs'], queryFn: hrisApi.hrisSettingLogs })
  const [workHours, setWorkHours] = useState('8')
  const [workMinutes, setWorkMinutes] = useState('0')
  const [graceMinutes, setGraceMinutes] = useState('15')
  const [scores, setScores] = useState(() => Object.fromEntries(ALL_FIELDS.map(f => [f.key, String(f.def)])))
  const [limits, setLimits] = useState(() => Object.fromEntries(THRESHOLD_FIELDS.map(f => [f.maxKey, String(f.maxDef)])))

  useEffect(() => {
    if (!settings) return
    setWorkHours(String(Math.floor(settings.minWorkMinutes / 60)))
    setWorkMinutes(String(settings.minWorkMinutes % 60))
    setGraceMinutes(String(settings.lateGraceMinutes))
    setScores(Object.fromEntries(ALL_FIELDS.map(f => [f.key, String(settings[f.key] ?? f.def)])))
    setLimits(Object.fromEntries(THRESHOLD_FIELDS.map(f => [f.maxKey, String(settings[f.maxKey] ?? f.maxDef)])))
  }, [settings])

  const save = useMutation({
    mutationFn: hrisApi.updateHrisSettings,
    onSuccess: () => {
      toast.success('Aturan jam kerja disimpan')
      qc.invalidateQueries({ queryKey: ['hris-settings'] })
      qc.invalidateQueries({ queryKey: ['hris-setting-logs'] })
    },
    onError: (e) => toast.error(e.response?.data?.message ?? 'Gagal menyimpan'),
  })

  function submit(e) {
    e.preventDefault()
    const minWorkMinutes = Number(workHours || 0) * 60 + Number(workMinutes || 0)
    const lateGraceMinutes = Number(graceMinutes || 0)
    const numeric = (obj) => Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, Number(v || 0)]))
    save.mutate({ minWorkMinutes, lateGraceMinutes, ...numeric(scores), ...numeric(limits) })
  }

  const previewWork = Number(workHours || 0) * 60 + Number(workMinutes || 0)
  const weight = Number(scores.workDurationWeight || 0)

  // Baris skor: label + hint, input poin, dan (kalau tier berbatas) input
  // batas menitnya biar admin bisa geser rentangnya sendiri. Dipanggil sebagai
  // fungsi (bukan komponen) supaya input tidak remount & kehilangan fokus.
  const row = (field, label, hint) => (
    <div key={field.key} className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm text-slate-700">{label}</p>
        <p className="text-[11px] text-slate-400 truncate">{hint}</p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {field.maxKey && (
          <>
            <input type="number" min="1" max="1440" className="input w-16" value={limits[field.maxKey]}
              onChange={e => setLimits(l => ({ ...l, [field.maxKey]: e.target.value }))} />
            <span className="text-[11px] text-slate-400">mnt</span>
          </>
        )}
        <input type="number" min="0" max={MAX_SCORE} className="input w-20" value={scores[field.key]}
          onChange={e => setScores(s => ({ ...s, [field.key]: e.target.value }))} />
      </div>
    </div>
  )

  return (
    <div className="px-6 py-6 max-w-2xl">
      {needsCompany && <div className="mb-4"><CompanyRequiredBanner action="mengatur jam kerja" /></div>}
      <div className="mb-5">
        <h1 className="text-lg font-bold text-slate-800">Aturan Jam Kerja</h1>
        <p className="text-xs text-slate-400 mt-0.5">
          Berlaku untuk semua karyawan di company ini. Setiap perubahan dicatat di riwayat paling bawah.
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
            Untuk poin lama jam kerja, karyawan yang punya shift dinilai dari rentang jam shift-nya sendiri;
            angka di sini jadi patokan bagi yang tidak punya shift.
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
            Untuk poin, jam datang tetap dihitung dari jam shift — toleransi ini tidak menambah poin.
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
            <p className="text-sm font-semibold text-slate-800">Poin Jam Datang</p>
          </div>
          <p className="text-xs text-slate-400 mb-3 leading-relaxed">
            Poin dari jam datang relatif ke jam mulai shift masing-masing. Batas menit tiap tier
            keterlambatan bisa digeser sendiri — kolom kiri batas menitnya, kolom kanan poinnya.
            Poin boleh sampai {MAX_SCORE} kalau mau memberi apresiasi, tapi urutannya wajib menurun:
            yang lebih disiplin tidak boleh dapat poin lebih kecil. Izin telat yang disetujui dapat
            bonus di atas skor jam datangnya, jadi selalu lebih tinggi dari telat tanpa izin. Kerja
            lapangan yang disetujui &amp; sudah di vendor saat absen dihitung normal, yang belum sampai
            vendor poinnya diisi reviewer, ditolak = 0. Absen = 0, cuti/sakit tidak dihitung.
            Aturan ini tampil ke semua karyawan di halaman Presensi.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
            {ARRIVAL_FIELDS.map((f, i) => row(f,
              f.label ?? tierLabel(ARRIVAL_FIELDS, i, limits, 'Telat'),
              f.hint ?? 'batas menit telat tier ini'))}
            {EXTRA_FIELDS.map(f => row(f, f.label, f.hint))}
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-2 mb-1">
            <Hourglass size={15} className="text-teal-500" />
            <p className="text-sm font-semibold text-slate-800">Poin Lama Jam Kerja</p>
          </div>
          <p className="text-xs text-slate-400 mb-3 leading-relaxed">
            Poin dari lama kerja hari itu (check-out − check-in) dibanding target durasi hari itu.
            Bobot menentukan porsinya di skor harian: 0 = skor murni jam datang, 100 = murni lama
            jam kerja, 30 = 30% lama kerja + 70% jam datang. Hari yang belum check-out dinilai dari
            jam datang saja, sedangkan yang <b>lupa check-out</b> (jam pulangnya diisi sistem) dapat
            tier terendah — biar tidak lebih untung daripada check-out jujur lebih awal.
          </p>
          <div className="flex items-center justify-between gap-3 pb-3 mb-3 border-b border-slate-100">
            <div className="min-w-0">
              <p className="text-sm text-slate-700">Bobot lama jam kerja</p>
              <p className="text-[11px] text-slate-400">
                {weight === 0
                  ? 'skor harian murni dari jam datang'
                  : `${weight}% lama kerja + ${100 - weight}% jam datang`}
              </p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <input type="number" min="0" max="100" className="input w-20" value={scores.workDurationWeight}
                onChange={e => setScores(s => ({ ...s, workDurationWeight: e.target.value }))} />
              <span className="text-[11px] text-slate-400">%</span>
            </div>
          </div>
          <div className={`grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 ${weight === 0 ? 'opacity-50' : ''}`}>
            {WORK_FIELDS.map((f, i) => row(f,
              f.label ?? tierLabel(WORK_FIELDS, i, limits, 'Kurang'),
              f.hint ?? (f.overtime
                ? 'ambang menit lembur; poin boleh di atas durasi penuh'
                : 'batas menit kurang dari target')))}
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-2 mb-1">
            <Trophy size={15} className="text-emerald-500" />
            <p className="text-sm font-semibold text-slate-800">Syarat Masuk Papan Skor</p>
          </div>
          <p className="text-xs text-slate-400 mb-3 leading-relaxed">
            Skor leaderboard adalah rata-rata harian, jadi yang datanya cuma beberapa hari bisa
            mengalahkan yang konsisten sebulan. Minimum hari ini menyaringnya. Otomatis dibatasi ke
            jumlah hari kerja yang sudah lewat, jadi awal bulan papannya tetap ada isinya.
          </p>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm text-slate-700">Minimum hari terhitung</p>
              <p className="text-[11px] text-slate-400">0 = semua orang masuk papan skor</p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <input type="number" min="0" max="31" className="input w-20" value={scores.leaderboardMinDays}
                onChange={e => setScores(s => ({ ...s, leaderboardMinDays: e.target.value }))} />
              <span className="text-[11px] text-slate-400">hari</span>
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button type="submit" disabled={save.isPending || needsCompany} className="btn-primary text-sm">
            {save.isPending ? 'Menyimpan…' : 'Simpan Aturan'}
          </button>
        </div>
      </form>

      <div className="card p-5 mt-4">
        <div className="flex items-center gap-2 mb-1">
          <History size={15} className="text-slate-400" />
          <p className="text-sm font-semibold text-slate-800">Riwayat Perubahan Kebijakan</p>
        </div>
        <p className="text-xs text-slate-400 mb-3 leading-relaxed">
          Skor harian dibekukan tiap tengah malam, jadi perubahan di sini berlaku untuk hari-hari
          berikutnya — ranking hari yang sudah ditutup tidak ikut berubah.
        </p>
        {!logs?.length ? (
          <p className="text-xs text-slate-400">Belum ada perubahan tercatat.</p>
        ) : (
          <ul className="space-y-2.5">
            {logs.map(log => (
              <li key={log.id} className="text-[11px] border-l-2 border-slate-100 pl-3">
                <p className="text-slate-500">
                  <b className="text-slate-700">{log.changer?.name ?? 'Sistem'}</b> · {fmtLogTime(log.createdAt)}
                </p>
                <p className="text-slate-400 leading-relaxed">
                  {Object.entries(log.changes ?? {})
                    .map(([key, v]) => `${key}: ${v.from} → ${v.to}`)
                    .join(' · ')}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
