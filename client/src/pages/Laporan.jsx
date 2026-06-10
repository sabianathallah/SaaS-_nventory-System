import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { reportApi, warehousesApi } from '../api'
import { useAuth } from '../context/AuthContext'
import { exportExcel } from '../utils/exportExcel'
import { FileDown } from 'lucide-react'

const MONTHS = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des']
const fmtNum = (n) => Number(n ?? 0).toLocaleString('id-ID')
const fmtRp  = (n) => {
  const v = Number(n ?? 0)
  if (v >= 1_000_000_000) return `Rp ${(v / 1_000_000_000).toFixed(1)}M`
  if (v >= 1_000_000)     return `Rp ${(v / 1_000_000).toFixed(1)}jt`
  if (v >= 1_000)         return `Rp ${(v / 1_000).toFixed(0)}rb`
  return `Rp ${fmtNum(v)}`
}

export default function Laporan() {
  const { hasPermission } = useAuth()
  const canViewValue = hasPermission('inventory.view_value') || hasPermission('inventory.manage')

  const currentYear = new Date().getFullYear()
  const [year, setYear]           = useState(currentYear)
  const [warehouseId, setWarehouseId] = useState('')

  const { data: warehouses } = useQuery({
    queryKey: ['warehouses', { limit: 100 }],
    queryFn:  () => warehousesApi.list({ limit: 100 }),
  })

  const { data, isLoading } = useQuery({
    queryKey: ['report-monthly', { year, warehouseId: warehouseId || undefined }],
    queryFn:  () => reportApi.monthly({ year, ...(warehouseId ? { warehouseId } : {}) }),
    staleTime: 60_000,
  })

  const months = data?.months ?? []

  const totals = months.reduce((acc, m) => ({
    inQty:    acc.inQty    + m.inQty,
    inValue:  acc.inValue  + m.inValue,
    outQty:   acc.outQty   + m.outQty,
    outValue: acc.outValue + m.outValue,
  }), { inQty: 0, inValue: 0, outQty: 0, outValue: 0 })

  function handleExport() {
    const whName = warehouseId
      ? (warehouses?.data?.find(w => String(w.id) === String(warehouseId))?.name ?? '')
      : 'Semua Gudang'

    const headers = canViewValue
      ? ['Bulan', 'Stock In (Qty)', 'Nilai Masuk', 'Stock Out (Qty)', 'Nilai Keluar', 'Net Qty']
      : ['Bulan', 'Stock In (Qty)', 'Stock Out (Qty)', 'Net Qty']

    const rows = months.map((m, i) => canViewValue
      ? [MONTHS[i], m.inQty, m.inValue, m.outQty, m.outValue, m.inQty - m.outQty]
      : [MONTHS[i], m.inQty, m.outQty, m.inQty - m.outQty]
    )

    const totalRow = canViewValue
      ? ['TOTAL', totals.inQty, totals.inValue, totals.outQty, totals.outValue, totals.inQty - totals.outQty]
      : ['TOTAL', totals.inQty, totals.outQty, totals.inQty - totals.outQty]

    exportExcel(`laporan-${year}-${whName}`, {
      headers,
      rows: [...rows, totalRow],
      sheetName: `Laporan ${year}`,
    })
  }

  const years = Array.from({ length: 5 }, (_, i) => currentYear - i)

  return (
    <div className="px-6 py-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-bold text-slate-800">Laporan Bulanan</h1>
          <p className="text-xs text-slate-400 mt-0.5">Ringkasan stock masuk & keluar per bulan</p>
        </div>
        <button
          onClick={handleExport}
          disabled={isLoading || !months.length}
          className="btn-secondary flex items-center gap-1.5 text-sm disabled:opacity-40"
        >
          <FileDown size={14} /> Export Excel
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-5 flex-wrap">
        <select
          value={year}
          onChange={e => setYear(Number(e.target.value))}
          className="input text-sm w-28"
        >
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <select
          value={warehouseId}
          onChange={e => setWarehouseId(e.target.value)}
          className="input text-sm w-48"
        >
          <option value="">Semua Gudang</option>
          {(warehouses?.data ?? []).map(w => (
            <option key={w.id} value={w.id}>{w.name}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="th py-3 text-left w-16">Bulan</th>
                <th className="th py-3 text-right">Stock In (Qty)</th>
                {canViewValue && <th className="th py-3 text-right">Nilai Masuk</th>}
                <th className="th py-3 text-right">Stock Out (Qty)</th>
                {canViewValue && <th className="th py-3 text-right">Nilai Keluar</th>}
                <th className="th py-3 text-right">Net Qty</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 12 }).map((_, i) => (
                  <tr key={i} className="border-b border-slate-50">
                    {Array.from({ length: canViewValue ? 6 : 4 }).map((_, j) => (
                      <td key={j} className="td py-3">
                        <div className="h-4 bg-slate-100 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : (
                months.map((m, i) => {
                  const net = m.inQty - m.outQty
                  const hasActivity = m.inQty > 0 || m.outQty > 0
                  return (
                    <tr key={i} className={`border-b border-slate-50 ${hasActivity ? '' : 'opacity-40'}`}>
                      <td className="td py-3 font-semibold text-slate-700">{MONTHS[i]}</td>
                      <td className="td py-3 text-right font-mono text-emerald-700 font-semibold">
                        {m.inQty > 0 ? `+${fmtNum(m.inQty)}` : '—'}
                      </td>
                      {canViewValue && (
                        <td className="td py-3 text-right font-mono text-slate-500 text-xs">
                          {m.inValue > 0 ? fmtRp(m.inValue) : '—'}
                        </td>
                      )}
                      <td className="td py-3 text-right font-mono text-red-600 font-semibold">
                        {m.outQty > 0 ? `-${fmtNum(m.outQty)}` : '—'}
                      </td>
                      {canViewValue && (
                        <td className="td py-3 text-right font-mono text-slate-500 text-xs">
                          {m.outValue > 0 ? fmtRp(m.outValue) : '—'}
                        </td>
                      )}
                      <td className={`td py-3 text-right font-mono font-bold ${net > 0 ? 'text-emerald-600' : net < 0 ? 'text-red-500' : 'text-slate-400'}`}>
                        {hasActivity ? (net > 0 ? `+${fmtNum(net)}` : fmtNum(net)) : '—'}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
            {!isLoading && months.length > 0 && (
              <tfoot>
                <tr className="bg-slate-50 border-t-2 border-slate-200">
                  <td className="td py-3 font-bold text-slate-700">Total</td>
                  <td className="td py-3 text-right font-mono font-bold text-emerald-700">
                    +{fmtNum(totals.inQty)}
                  </td>
                  {canViewValue && (
                    <td className="td py-3 text-right font-mono font-bold text-slate-600">
                      {fmtRp(totals.inValue)}
                    </td>
                  )}
                  <td className="td py-3 text-right font-mono font-bold text-red-600">
                    -{fmtNum(totals.outQty)}
                  </td>
                  {canViewValue && (
                    <td className="td py-3 text-right font-mono font-bold text-slate-600">
                      {fmtRp(totals.outValue)}
                    </td>
                  )}
                  <td className={`td py-3 text-right font-mono font-bold text-lg ${totals.inQty - totals.outQty >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                    {totals.inQty - totals.outQty >= 0 ? '+' : ''}{fmtNum(totals.inQty - totals.outQty)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  )
}
