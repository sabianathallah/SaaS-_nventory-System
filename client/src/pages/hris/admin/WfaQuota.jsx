import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { hrisApi } from '../../../api'
import { Save } from 'lucide-react'
import { useCompanyGuard } from '../../../hooks/useCompanyGuard'
import CompanyRequiredBanner from '../../../components/CompanyRequiredBanner'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

export default function WfaQuota() {
  const qc = useQueryClient()
  const { needsCompany } = useCompanyGuard()
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [defaultDraft, setDefaultDraft] = useState('')
  const [drafts, setDrafts] = useState({})

  const { data: settings } = useQuery({ queryKey: ['hris-wfa-settings'], queryFn: hrisApi.wfaSettings })
  const { data, isLoading } = useQuery({
    queryKey: ['hris-wfa-quota-admin', month, year],
    queryFn: () => hrisApi.wfaQuotaAdmin({ month, year }),
  })

  useEffect(() => { if (settings) setDefaultDraft(String(settings.defaultMonthlyQuota)) }, [settings])

  const updateSettings = useMutation({
    mutationFn: hrisApi.updateWfaSettings,
    onSuccess: () => { toast.success('Default kuota diperbarui'); qc.invalidateQueries({ queryKey: ['hris-wfa-settings'] }); qc.invalidateQueries({ queryKey: ['hris-wfa-quota-admin'] }) },
    onError: (e) => toast.error(e.response?.data?.message ?? 'Gagal update'),
  })
  const adjust = useMutation({
    mutationFn: hrisApi.adjustWfaQuota,
    onSuccess: () => { toast.success('Kuota user diperbarui'); qc.invalidateQueries({ queryKey: ['hris-wfa-quota-admin'] }) },
    onError: (e) => toast.error(e.response?.data?.message ?? 'Gagal update kuota'),
  })

  const users = data?.users ?? []

  return (
    <div className="px-6 py-6 max-w-4xl">
      <div className="mb-5">
        <h1 className="text-lg font-bold text-slate-800">Kuota WFA</h1>
        <p className="text-xs text-slate-400 mt-0.5">Atur jatah WFA default per bulan, dan override per karyawan bila perlu</p>
      </div>

      {needsCompany && <div className="mb-6"><CompanyRequiredBanner action="mengatur kuota WFA" /></div>}

      <div className="card p-4 mb-6 flex items-center gap-3 flex-wrap">
        <label className="label mb-0">Default Kuota / Bulan</label>
        <input type="number" min="0" disabled={needsCompany} className="input w-24 disabled:opacity-40 disabled:cursor-not-allowed" value={defaultDraft} onChange={e => setDefaultDraft(e.target.value)} />
        <button
          onClick={() => {
            if (needsCompany) return toast.error('Pilih perusahaan terlebih dahulu')
            updateSettings.mutate({ defaultMonthlyQuota: Number(defaultDraft) })
          }}
          disabled={updateSettings.isPending || needsCompany}
          className="btn-primary text-sm"
        >
          Simpan Default
        </button>
      </div>

      <div className="flex gap-3 mb-4">
        <select className="select w-32" value={month} onChange={e => setMonth(Number(e.target.value))}>
          {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
        </select>
        <select className="select w-28" value={year} onChange={e => setYear(Number(e.target.value))}>
          {[year - 1, year, year + 1].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="th">Nama</th>
                <th className="th text-center">Kuota</th>
                <th className="th text-center">Terpakai</th>
                <th className="th text-center">Sisa</th>
                <th className="th text-center">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={5} className="td py-8 text-center text-slate-400">Memuat…</td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan={5} className="td py-8 text-center text-slate-400">Belum ada user</td></tr>
              ) : users.map(u => {
                const draft = drafts[u.userId]
                const value = draft !== undefined ? draft : u.allocated
                return (
                  <tr key={u.userId} className="tr">
                    <td className="td">
                      <div className="font-medium">{u.userName}</div>
                      {u.divisi && <div className="text-xs text-slate-400">{u.divisi}</div>}
                    </td>
                    <td className="td text-center">
                      <input
                        type="number" min="0"
                        disabled={needsCompany}
                        className="input w-16 text-center text-xs py-1 mx-auto disabled:opacity-40 disabled:cursor-not-allowed"
                        value={value}
                        onChange={e => setDrafts(d => ({ ...d, [u.userId]: e.target.value }))}
                      />
                    </td>
                    <td className="td text-center">{u.used}</td>
                    <td className="td text-center">{u.remaining}</td>
                    <td className="td text-center">
                      <button
                        disabled={needsCompany}
                        title="Simpan"
                        onClick={() => {
                          if (needsCompany) return toast.error('Pilih perusahaan terlebih dahulu')
                          adjust.mutate({ userId: u.userId, month, year, allocated: Number(value) })
                        }}
                        className="w-7 h-7 rounded flex items-center justify-center text-brand hover:bg-brand-50 mx-auto disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <Save size={13} />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
