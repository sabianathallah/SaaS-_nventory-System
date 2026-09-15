import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { hrisApi } from '../../api'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
const fmtRupiah = (n) => `Rp${Number(n).toLocaleString('id-ID')}`

export default function PaymentAdjustments() {
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())

  const { data, isLoading } = useQuery({
    queryKey: ['hris-payment-adjustments', month, year],
    queryFn: () => hrisApi.paymentAdjustments({ month, year, limit: 100 }),
  })

  const rows = data?.data ?? []
  const total = rows.reduce((sum, r) => sum + Number(r.amount), 0)

  return (
    <div className="px-6 py-6 max-w-4xl">
      <div className="mb-5">
        <h1 className="text-lg font-bold text-slate-800">Penyesuaian Payment</h1>
        <p className="text-xs text-slate-400 mt-0.5">Rekap nominal penyesuaian dari WFA yang melebihi kuota — bukan slip gaji, hanya catatan untuk tim payroll</p>
      </div>

      <div className="flex gap-3 mb-4">
        <select className="select w-32" value={month} onChange={e => setMonth(Number(e.target.value))}>
          {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
        </select>
        <select className="select w-28" value={year} onChange={e => setYear(Number(e.target.value))}>
          {[year - 1, year, year + 1].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      <div className="card p-4 mb-4">
        <p className="text-xs font-semibold text-slate-600">Total Penyesuaian Bulan Ini</p>
        <p className="text-xl font-bold text-brand mt-1">{fmtRupiah(total)}</p>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="th">Nama</th>
                <th className="th">Tanggal WFA</th>
                <th className="th">Nominal</th>
                <th className="th">Catatan</th>
                <th className="th">Dibuat oleh</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={5} className="td py-8 text-center text-slate-400">Memuat…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={5} className="td py-8 text-center text-slate-400">Belum ada penyesuaian</td></tr>
              ) : rows.map(r => (
                <tr key={r.id} className="tr">
                  <td className="td">{r.user?.name ?? '—'}</td>
                  <td className="td">{fmtDate(r.wfaRequest?.date)}</td>
                  <td className="td font-medium">{fmtRupiah(r.amount)}</td>
                  <td className="td max-w-[220px] truncate">{r.note || '—'}</td>
                  <td className="td">{r.creator?.name ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
