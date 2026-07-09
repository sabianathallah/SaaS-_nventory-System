import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { hrisApi } from '../../../api'
import { Save } from 'lucide-react'
import { useCompanyGuard } from '../../../hooks/useCompanyGuard'
import CompanyRequiredBanner from '../../../components/CompanyRequiredBanner'

const FIELDS = [
  { key: 'fixedSalary', label: 'Fixed Salary' },
  { key: 'allowanceTransport', label: 'Tunjangan Transportasi' },
  { key: 'allowanceMeal', label: 'Tunjangan Makan' },
]

export default function SalaryProfiles() {
  const qc = useQueryClient()
  const { needsCompany } = useCompanyGuard()
  const [drafts, setDrafts] = useState({}) // { [userId]: { fixedSalary, allowanceTransport, allowanceMeal } }

  const { data: users, isLoading } = useQuery({
    queryKey: ['hris-salary-profiles'],
    queryFn: () => hrisApi.salaryProfiles({}),
  })

  const save = useMutation({
    mutationFn: hrisApi.upsertSalaryProfile,
    onSuccess: () => { toast.success('Profil gaji disimpan'); qc.invalidateQueries({ queryKey: ['hris-salary-profiles'] }) },
    onError: (e) => toast.error(e.response?.data?.message ?? 'Gagal menyimpan'),
  })

  function valueFor(u, key) {
    const draft = drafts[u.id]?.[key]
    if (draft !== undefined) return draft
    return u.salaryProfile?.[key] ?? 0
  }
  function setValue(userId, key, value) {
    setDrafts(d => ({ ...d, [userId]: { ...d[userId], [key]: value } }))
  }

  return (
    <div className="px-6 py-6 max-w-4xl">
      <div className="mb-5">
        <h1 className="text-lg font-bold text-slate-800">Profil Gaji</h1>
        <p className="text-xs text-slate-400 mt-0.5">Fixed Salary & Tunjangan per karyawan — diisi sekali, otomatis terpakai tiap generate Slip Gaji bulanan</p>
      </div>

      {needsCompany && <div className="mb-6"><CompanyRequiredBanner action="mengatur profil gaji" /></div>}

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="th">Nama</th>
                {FIELDS.map(f => <th key={f.key} className="th text-right">{f.label}</th>)}
                <th className="th text-center">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={5} className="td py-8 text-center text-slate-400">Memuat…</td></tr>
              ) : (users ?? []).length === 0 ? (
                <tr><td colSpan={5} className="td py-8 text-center text-slate-400">Belum ada karyawan</td></tr>
              ) : (users ?? []).map(u => (
                <tr key={u.id} className="tr">
                  <td className="td">
                    <div className="font-medium">{u.name}</div>
                    {u.divisi && <div className="text-xs text-slate-400">{u.divisi}</div>}
                  </td>
                  {FIELDS.map(f => (
                    <td key={f.key} className="td">
                      <input
                        type="number" min="0"
                        disabled={needsCompany}
                        className="input w-32 text-right text-xs py-1 ml-auto disabled:opacity-40 disabled:cursor-not-allowed"
                        value={valueFor(u, f.key)}
                        onChange={e => setValue(u.id, f.key, e.target.value)}
                      />
                    </td>
                  ))}
                  <td className="td text-center">
                    <button
                      disabled={needsCompany || save.isPending}
                      title="Simpan"
                      onClick={() => {
                        if (needsCompany) return toast.error('Pilih perusahaan terlebih dahulu')
                        save.mutate({
                          userId: u.id,
                          fixedSalary: Number(valueFor(u, 'fixedSalary')),
                          allowanceTransport: Number(valueFor(u, 'allowanceTransport')),
                          allowanceMeal: Number(valueFor(u, 'allowanceMeal')),
                        })
                      }}
                      className="w-7 h-7 rounded flex items-center justify-center text-brand hover:bg-brand-50 mx-auto disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Save size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
