import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { hrisApi } from '../../../api'
import { Save } from 'lucide-react'

export default function LeaveQuota() {
  const qc = useQueryClient()
  const [year, setYear] = useState(new Date().getFullYear())
  const [drafts, setDrafts] = useState({}) // `${userId}:${leaveTypeId}` -> value

  const { data, isLoading } = useQuery({
    queryKey: ['hris-leave-balances-admin', year],
    queryFn: () => hrisApi.leaveBalancesAdmin({ year }),
  })

  const adjust = useMutation({
    mutationFn: hrisApi.adjustLeaveBalance,
    onSuccess: () => { toast.success('Kuota diperbarui'); qc.invalidateQueries({ queryKey: ['hris-leave-balances-admin'] }) },
    onError: (e) => toast.error(e.response?.data?.message ?? 'Gagal update kuota'),
  })

  const types = data?.types ?? []
  const users = data?.users ?? []

  function keyOf(userId, leaveTypeId) { return `${userId}:${leaveTypeId}` }

  function handleSave(userId, leaveTypeId) {
    const k = keyOf(userId, leaveTypeId)
    const value = drafts[k]
    if (value === undefined || value === '') return
    adjust.mutate({ userId, leaveTypeId, year, allocated: Number(value) })
  }

  return (
    <div className="px-6 py-6 max-w-5xl">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-bold text-slate-800">Kuota Cuti</h1>
          <p className="text-xs text-slate-400 mt-0.5">Atur jatah cuti per karyawan per jenis cuti untuk tahun tertentu</p>
        </div>
        <select className="select w-32" value={year} onChange={e => setYear(Number(e.target.value))}>
          {[year - 1, year, year + 1].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="th">Nama</th>
                {types.map(t => <th key={t.id} className="th text-center">{t.name}</th>)}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={types.length + 1} className="td py-8 text-center text-slate-400">Memuat…</td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan={types.length + 1} className="td py-8 text-center text-slate-400">Belum ada user</td></tr>
              ) : users.map(u => (
                <tr key={u.userId} className="tr">
                  <td className="td">
                    <div className="font-medium">{u.userName}</div>
                    {u.divisi && <div className="text-xs text-slate-400">{u.divisi}</div>}
                  </td>
                  {u.balances.map(b => {
                    const k = keyOf(u.userId, b.leaveTypeId)
                    const draft = drafts[k]
                    const value = draft !== undefined ? draft : b.allocated
                    return (
                      <td key={b.leaveTypeId} className="td text-center">
                        <div className="flex items-center justify-center gap-1">
                          <input
                            type="number" min="0"
                            className="input w-16 text-center text-xs py-1"
                            value={value}
                            onChange={e => setDrafts(d => ({ ...d, [k]: e.target.value }))}
                          />
                          <button
                            title="Simpan"
                            onClick={() => handleSave(u.userId, b.leaveTypeId)}
                            className="w-6 h-6 rounded flex items-center justify-center text-brand hover:bg-brand-50"
                          >
                            <Save size={12} />
                          </button>
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">terpakai {b.used}</div>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
