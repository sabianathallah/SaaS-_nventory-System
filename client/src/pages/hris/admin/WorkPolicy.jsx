import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { hrisApi } from '../../../api'
import { useCompanyGuard } from '../../../hooks/useCompanyGuard'
import CompanyRequiredBanner from '../../../components/CompanyRequiredBanner'
import { Timer, AlarmClock } from 'lucide-react'

const fmtDur = (m) => {
  const h = Math.floor(m / 60), mm = m % 60
  return h && mm ? `${h} jam ${mm} menit` : h ? `${h} jam` : `${mm} menit`
}

export default function WorkPolicy() {
  const qc = useQueryClient()
  const { needsCompany } = useCompanyGuard()

  const { data: settings } = useQuery({ queryKey: ['hris-settings'], queryFn: hrisApi.hrisSettings })
  const [workHours, setWorkHours] = useState('8')
  const [workMinutes, setWorkMinutes] = useState('0')
  const [graceMinutes, setGraceMinutes] = useState('15')

  useEffect(() => {
    if (!settings) return
    setWorkHours(String(Math.floor(settings.minWorkMinutes / 60)))
    setWorkMinutes(String(settings.minWorkMinutes % 60))
    setGraceMinutes(String(settings.lateGraceMinutes))
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
    save.mutate({ minWorkMinutes, lateGraceMinutes })
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

        <div className="flex justify-end">
          <button type="submit" disabled={save.isPending || needsCompany} className="btn-primary text-sm">
            {save.isPending ? 'Menyimpan…' : 'Simpan Aturan'}
          </button>
        </div>
      </form>
    </div>
  )
}
