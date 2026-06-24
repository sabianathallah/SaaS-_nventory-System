import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { reportApi, warehousesApi } from '../api'
import { useAuth } from '../context/AuthContext'
import { exportExcel } from '../utils/exportExcel'
import { FileDown, Eye, EyeOff } from 'lucide-react'

const MONTHS = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des']
const MONTHS_FULL = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember']

const fmtNum = (n) => Number(n ?? 0).toLocaleString('id-ID')
const fmtRp  = (n) => {
  const v = Number(n ?? 0)
  if (v >= 1_000_000_000) return `Rp ${(v / 1_000_000_000).toFixed(1)}M`
  if (v >= 1_000_000)     return `Rp ${(v / 1_000_000).toFixed(1)}jt`
  if (v >= 1_000)         return `Rp ${(v / 1_000).toFixed(0)}rb`
  return `Rp ${fmtNum(v)}`
}

function SkeletonRow({ cols }) {
  return Array.from({ length: 10 }).map((_, i) => (
    <tr key={i} className="border-b border-slate-50">
      {Array.from({ length: cols }).map((_, j) => (
        <td key={j} className="td py-3">
          <div className="h-4 bg-slate-100 rounded animate-pulse" />
        </td>
      ))}
    </tr>
  ))
}

// ─── Tab: Harian ─────────────────────────────────────────────────────────────
function TabHarian({ canViewValue, warehouseId, hideInitial }) {
  const now = new Date()
  const [year,  setYear]  = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i)

  const { data, isLoading } = useQuery({
    queryKey: ['report-daily', { year, month, warehouseId: warehouseId || undefined, hideInitial }],
    queryFn:  () => reportApi.daily({ year, month, ...(warehouseId ? { warehouseId } : {}), hideInitial }),
    staleTime: 60_000,
  })

  const days = data?.days ?? []
  const totals = days.reduce((a, d) => ({
    inQty: a.inQty + d.inQty, inValue: a.inValue + d.inValue,
    outQty: a.outQty + d.outQty, outValue: a.outValue + d.outValue,
  }), { inQty: 0, inValue: 0, outQty: 0, outValue: 0 })

  function handleExport() {
    const headers = canViewValue
      ? ['Tgl', 'Stock In (Qty)', 'Nilai Masuk', 'Stock Out (Qty)', 'Nilai Keluar', 'Net Qty', 'Stok Akhir']
      : ['Tgl', 'Stock In (Qty)', 'Stock Out (Qty)', 'Net Qty', 'Stok Akhir']
    const rows = days.map(d => canViewValue
      ? [d.day, d.inQty, d.inValue, d.outQty, d.outValue, d.inQty - d.outQty, d.endingStock]
      : [d.day, d.inQty, d.outQty, d.inQty - d.outQty, d.endingStock]
    )
    exportExcel(`laporan-harian-${year}-${String(month).padStart(2,'0')}`, {
      headers, rows, sheetName: `${MONTHS_FULL[month-1]} ${year}`,
    })
  }

  const colCount = canViewValue ? 7 : 5

  return (
    <div>
      <div className="flex gap-3 mb-5 flex-wrap items-center justify-between">
        <div className="flex gap-3 flex-wrap">
          <select value={year} onChange={e => setYear(Number(e.target.value))} className="input text-sm w-28">
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <select value={month} onChange={e => setMonth(Number(e.target.value))} className="input text-sm w-40">
            {MONTHS_FULL.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
          </select>
        </div>
        <button onClick={handleExport} disabled={isLoading || !days.length} className="btn-secondary flex items-center gap-1.5 text-sm disabled:opacity-40">
          <FileDown size={14} /> Export Excel
        </button>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="th py-3 text-left w-12">Tgl</th>
                <th className="th py-3 text-right">Stock In (Qty)</th>
                {canViewValue && <th className="th py-3 text-right">Nilai Masuk</th>}
                <th className="th py-3 text-right">Stock Out (Qty)</th>
                {canViewValue && <th className="th py-3 text-right">Nilai Keluar</th>}
                <th className="th py-3 text-right">Net</th>
                <th className="th py-3 text-right">Stok Akhir</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? <SkeletonRow cols={colCount} /> : days.map((d) => {
                const net = d.inQty - d.outQty
                const active = d.inQty > 0 || d.outQty > 0
                return (
                  <tr key={d.day} className={`border-b border-slate-50 ${active ? '' : 'opacity-40'}`}>
                    <td className="td py-2.5 font-semibold text-slate-700 w-12">{d.day}</td>
                    <td className="td py-2.5 text-right font-mono text-emerald-700 font-semibold">{d.inQty > 0 ? `+${fmtNum(d.inQty)}` : '—'}</td>
                    {canViewValue && <td className="td py-2.5 text-right font-mono text-slate-500 text-xs">{d.inValue > 0 ? fmtRp(d.inValue) : '—'}</td>}
                    <td className="td py-2.5 text-right font-mono text-red-600 font-semibold">{d.outQty > 0 ? `-${fmtNum(d.outQty)}` : '—'}</td>
                    {canViewValue && <td className="td py-2.5 text-right font-mono text-slate-500 text-xs">{d.outValue > 0 ? fmtRp(d.outValue) : '—'}</td>}
                    <td className={`td py-2.5 text-right font-mono font-bold ${net > 0 ? 'text-emerald-600' : net < 0 ? 'text-red-500' : 'text-slate-400'}`}>
                      {active ? (net >= 0 ? `+${fmtNum(net)}` : fmtNum(net)) : '—'}
                    </td>
                    <td className="td py-2.5 text-right font-mono text-slate-700 font-semibold">{fmtNum(d.endingStock)}</td>
                  </tr>
                )
              })}
            </tbody>
            {!isLoading && days.length > 0 && (
              <tfoot>
                <tr className="bg-slate-50 border-t-2 border-slate-200">
                  <td className="td py-3 font-bold text-slate-700">Total</td>
                  <td className="td py-3 text-right font-mono font-bold text-emerald-700">+{fmtNum(totals.inQty)}</td>
                  {canViewValue && <td className="td py-3 text-right font-mono font-bold text-slate-600">{fmtRp(totals.inValue)}</td>}
                  <td className="td py-3 text-right font-mono font-bold text-red-600">-{fmtNum(totals.outQty)}</td>
                  {canViewValue && <td className="td py-3 text-right font-mono font-bold text-slate-600">{fmtRp(totals.outValue)}</td>}
                  <td className={`td py-3 text-right font-mono font-bold ${totals.inQty - totals.outQty >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                    {totals.inQty - totals.outQty >= 0 ? '+' : ''}{fmtNum(totals.inQty - totals.outQty)}
                  </td>
                  <td className="td py-3 text-right font-mono font-bold text-slate-700">{fmtNum(days[days.length - 1]?.endingStock ?? 0)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  )
}

// ─── Tab: Bulanan ─────────────────────────────────────────────────────────────
function TabBulanan({ canViewValue, warehouseId, hideInitial }) {
  const currentYear = new Date().getFullYear()
  const [year, setYear] = useState(currentYear)
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i)

  const { data, isLoading } = useQuery({
    queryKey: ['report-monthly', { year, warehouseId: warehouseId || undefined, hideInitial }],
    queryFn:  () => reportApi.monthly({ year, ...(warehouseId ? { warehouseId } : {}), hideInitial }),
    staleTime: 60_000,
  })

  const months = data?.months ?? []
  const totals = months.reduce((a, m) => ({
    inQty: a.inQty + m.inQty, inValue: a.inValue + m.inValue,
    outQty: a.outQty + m.outQty, outValue: a.outValue + m.outValue,
  }), { inQty: 0, inValue: 0, outQty: 0, outValue: 0 })

  function handleExport() {
    const headers = canViewValue
      ? ['Bulan', 'Stock In (Qty)', 'Nilai Masuk', 'Stock Out (Qty)', 'Nilai Keluar', 'Net Qty', 'Stok Akhir']
      : ['Bulan', 'Stock In (Qty)', 'Stock Out (Qty)', 'Net Qty', 'Stok Akhir']
    const rows = months.map((m, i) => canViewValue
      ? [MONTHS[i], m.inQty, m.inValue, m.outQty, m.outValue, m.inQty - m.outQty, m.endingStock]
      : [MONTHS[i], m.inQty, m.outQty, m.inQty - m.outQty, m.endingStock]
    )
    const totalRow = canViewValue
      ? ['TOTAL', totals.inQty, totals.inValue, totals.outQty, totals.outValue, totals.inQty - totals.outQty, '']
      : ['TOTAL', totals.inQty, totals.outQty, totals.inQty - totals.outQty, '']
    exportExcel(`laporan-bulanan-${year}`, { headers, rows: [...rows, totalRow], sheetName: `Laporan ${year}` })
  }

  const colCount = canViewValue ? 7 : 5

  return (
    <div>
      <div className="flex gap-3 mb-5 flex-wrap items-center justify-between">
        <select value={year} onChange={e => setYear(Number(e.target.value))} className="input text-sm w-28">
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <button onClick={handleExport} disabled={isLoading || !months.length} className="btn-secondary flex items-center gap-1.5 text-sm disabled:opacity-40">
          <FileDown size={14} /> Export Excel
        </button>
      </div>

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
                <th className="th py-3 text-right">Net</th>
                <th className="th py-3 text-right">Stok Akhir</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? <SkeletonRow cols={colCount} /> : months.map((m, i) => {
                const net = m.inQty - m.outQty
                const active = m.inQty > 0 || m.outQty > 0
                return (
                  <tr key={i} className={`border-b border-slate-50 ${active ? '' : 'opacity-40'}`}>
                    <td className="td py-3 font-semibold text-slate-700">{MONTHS[i]}</td>
                    <td className="td py-3 text-right font-mono text-emerald-700 font-semibold">{m.inQty > 0 ? `+${fmtNum(m.inQty)}` : '—'}</td>
                    {canViewValue && <td className="td py-3 text-right font-mono text-slate-500 text-xs">{m.inValue > 0 ? fmtRp(m.inValue) : '—'}</td>}
                    <td className="td py-3 text-right font-mono text-red-600 font-semibold">{m.outQty > 0 ? `-${fmtNum(m.outQty)}` : '—'}</td>
                    {canViewValue && <td className="td py-3 text-right font-mono text-slate-500 text-xs">{m.outValue > 0 ? fmtRp(m.outValue) : '—'}</td>}
                    <td className={`td py-3 text-right font-mono font-bold ${net > 0 ? 'text-emerald-600' : net < 0 ? 'text-red-500' : 'text-slate-400'}`}>
                      {active ? (net >= 0 ? `+${fmtNum(net)}` : fmtNum(net)) : '—'}
                    </td>
                    <td className="td py-3 text-right font-mono text-slate-700 font-semibold">{fmtNum(m.endingStock)}</td>
                  </tr>
                )
              })}
            </tbody>
            {!isLoading && months.length > 0 && (
              <tfoot>
                <tr className="bg-slate-50 border-t-2 border-slate-200">
                  <td className="td py-3 font-bold text-slate-700">Total</td>
                  <td className="td py-3 text-right font-mono font-bold text-emerald-700">+{fmtNum(totals.inQty)}</td>
                  {canViewValue && <td className="td py-3 text-right font-mono font-bold text-slate-600">{fmtRp(totals.inValue)}</td>}
                  <td className="td py-3 text-right font-mono font-bold text-red-600">-{fmtNum(totals.outQty)}</td>
                  {canViewValue && <td className="td py-3 text-right font-mono font-bold text-slate-600">{fmtRp(totals.outValue)}</td>}
                  <td className={`td py-3 text-right font-mono font-bold text-lg ${totals.inQty - totals.outQty >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                    {totals.inQty - totals.outQty >= 0 ? '+' : ''}{fmtNum(totals.inQty - totals.outQty)}
                  </td>
                  <td className="td py-3 text-right font-mono font-bold text-slate-700">{fmtNum(months[11]?.endingStock ?? 0)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  )
}

// ─── Tab: Tahunan ─────────────────────────────────────────────────────────────
function TabTahunan({ canViewValue, warehouseId, hideInitial }) {
  const { data, isLoading } = useQuery({
    queryKey: ['report-yearly', { warehouseId: warehouseId || undefined, hideInitial }],
    queryFn:  () => reportApi.yearly({ ...(warehouseId ? { warehouseId } : {}), hideInitial }),
    staleTime: 60_000,
  })

  const years = data?.years ?? []

  function handleExport() {
    const headers = canViewValue
      ? ['Tahun', 'Stock In (Qty)', 'Nilai Masuk', 'Stock Out (Qty)', 'Nilai Keluar', 'Net Qty', 'Stok Akhir']
      : ['Tahun', 'Stock In (Qty)', 'Stock Out (Qty)', 'Net Qty', 'Stok Akhir']
    const rows = years.map(y => canViewValue
      ? [y.year, y.inQty, y.inValue, y.outQty, y.outValue, y.inQty - y.outQty, y.endingStock]
      : [y.year, y.inQty, y.outQty, y.inQty - y.outQty, y.endingStock]
    )
    exportExcel('laporan-tahunan', { headers, rows, sheetName: 'Laporan Tahunan' })
  }

  const colCount = canViewValue ? 7 : 5

  return (
    <div>
      <div className="flex justify-end mb-5">
        <button onClick={handleExport} disabled={isLoading || !years.length} className="btn-secondary flex items-center gap-1.5 text-sm disabled:opacity-40">
          <FileDown size={14} /> Export Excel
        </button>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="th py-3 text-left w-20">Tahun</th>
                <th className="th py-3 text-right">Stock In (Qty)</th>
                {canViewValue && <th className="th py-3 text-right">Nilai Masuk</th>}
                <th className="th py-3 text-right">Stock Out (Qty)</th>
                {canViewValue && <th className="th py-3 text-right">Nilai Keluar</th>}
                <th className="th py-3 text-right">Net</th>
                <th className="th py-3 text-right">Stok Akhir</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? <SkeletonRow cols={colCount} /> : years.map((y) => {
                const net = y.inQty - y.outQty
                const active = y.inQty > 0 || y.outQty > 0
                return (
                  <tr key={y.year} className={`border-b border-slate-50 ${active ? '' : 'opacity-40'}`}>
                    <td className="td py-3 font-bold text-slate-800">{y.year}</td>
                    <td className="td py-3 text-right font-mono text-emerald-700 font-semibold">{y.inQty > 0 ? `+${fmtNum(y.inQty)}` : '—'}</td>
                    {canViewValue && <td className="td py-3 text-right font-mono text-slate-500 text-xs">{y.inValue > 0 ? fmtRp(y.inValue) : '—'}</td>}
                    <td className="td py-3 text-right font-mono text-red-600 font-semibold">{y.outQty > 0 ? `-${fmtNum(y.outQty)}` : '—'}</td>
                    {canViewValue && <td className="td py-3 text-right font-mono text-slate-500 text-xs">{y.outValue > 0 ? fmtRp(y.outValue) : '—'}</td>}
                    <td className={`td py-3 text-right font-mono font-bold ${net > 0 ? 'text-emerald-600' : net < 0 ? 'text-red-500' : 'text-slate-400'}`}>
                      {active ? (net >= 0 ? `+${fmtNum(net)}` : fmtNum(net)) : '—'}
                    </td>
                    <td className="td py-3 text-right font-mono font-bold text-slate-700">{fmtNum(y.endingStock)}</td>
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

// ─── Tab: Stok Saat Ini ───────────────────────────────────────────────────────
function TabSnapshot({ canViewValue, warehouseId }) {
  const [search, setSearch] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['report-snapshot', { warehouseId: warehouseId || undefined }],
    queryFn:  () => reportApi.snapshot({ ...(warehouseId ? { warehouseId } : {}) }),
    staleTime: 30_000,
  })

  const items = (data?.items ?? []).filter(r =>
    !search || r.productName.toLowerCase().includes(search.toLowerCase()) ||
    (r.productSku ?? '').toLowerCase().includes(search.toLowerCase()) ||
    r.articleName.toLowerCase().includes(search.toLowerCase())
  )

  const totalQty   = items.reduce((s, r) => s + r.totalQty, 0)
  const totalValue = items.reduce((s, r) => s + r.totalValue, 0)

  function handleExport() {
    const headers = canViewValue
      ? ['Produk', 'SKU', 'Koleksi', 'Stok (Qty)', 'Nilai']
      : ['Produk', 'SKU', 'Koleksi', 'Stok (Qty)']
    const rows = items.map(r => canViewValue
      ? [r.productName, r.productSku ?? '', r.articleName, r.totalQty, r.totalValue]
      : [r.productName, r.productSku ?? '', r.articleName, r.totalQty]
    )
    exportExcel('stok-saat-ini', { headers, rows, sheetName: 'Stok Saat Ini' })
  }

  const colCount = canViewValue ? 5 : 4

  return (
    <div>
      <div className="flex gap-3 mb-5 flex-wrap items-center justify-between">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Cari produk / SKU / koleksi…"
          className="input text-sm w-64"
        />
        <button onClick={handleExport} disabled={isLoading || !items.length} className="btn-secondary flex items-center gap-1.5 text-sm disabled:opacity-40">
          <FileDown size={14} /> Export Excel
        </button>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="th py-3 text-left">Produk</th>
                <th className="th py-3 text-left">Koleksi</th>
                <th className="th py-3 text-right w-24">Stok</th>
                {canViewValue && <th className="th py-3 text-right w-36">Nilai</th>}
              </tr>
            </thead>
            <tbody>
              {isLoading ? <SkeletonRow cols={colCount} /> : items.map((r) => (
                <tr key={r.productId} className={`border-b border-slate-50 ${r.totalQty === 0 ? 'opacity-40' : ''}`}>
                  <td className="td py-2.5">
                    <div className="font-medium text-slate-800">{r.productName}</div>
                    {r.productSku && <div className="text-xs text-slate-400 font-mono">{r.productSku}</div>}
                  </td>
                  <td className="td py-2.5 text-slate-500 text-xs">{r.articleName}</td>
                  <td className="td py-2.5 text-right font-mono font-bold text-slate-700">{fmtNum(r.totalQty)}</td>
                  {canViewValue && (
                    <td className="td py-2.5 text-right font-mono text-slate-600 text-xs">{r.totalValue > 0 ? fmtRp(r.totalValue) : '—'}</td>
                  )}
                </tr>
              ))}
            </tbody>
            {!isLoading && items.length > 0 && (
              <tfoot>
                <tr className="bg-slate-50 border-t-2 border-slate-200">
                  <td className="td py-3 font-bold text-slate-700" colSpan={2}>{items.length} produk</td>
                  <td className="td py-3 text-right font-mono font-bold text-slate-800">{fmtNum(totalQty)}</td>
                  {canViewValue && <td className="td py-3 text-right font-mono font-bold text-slate-700">{fmtRp(totalValue)}</td>}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
const TABS = [
  { key: 'harian',   label: 'Harian' },
  { key: 'bulanan',  label: 'Bulanan' },
  { key: 'tahunan',  label: 'Tahunan' },
  { key: 'snapshot', label: 'Stok Saat Ini' },
]

export default function Laporan() {
  const { hasPermission } = useAuth()
  const canViewValue = hasPermission('inventory.view_value') || hasPermission('inventory.manage')

  const [activeTab,    setActiveTab]    = useState('bulanan')
  const [warehouseId,  setWarehouseId]  = useState('')
  const [hideInitial,  setHideInitial]  = useState(false)

  const { data: warehouses } = useQuery({
    queryKey: ['warehouses', { limit: 100 }],
    queryFn:  () => warehousesApi.list({ limit: 100 }),
  })

  const tabProps = { canViewValue, warehouseId, hideInitial }

  return (
    <div className="px-6 py-6 max-w-5xl">
      {/* Header */}
      <div className="mb-5">
        <h1 className="text-lg font-bold text-slate-800">Laporan</h1>
        <p className="text-xs text-slate-400 mt-0.5">Laporan pergerakan stok harian, bulanan, tahunan, dan snapshot saat ini</p>
      </div>

      {/* Global filters */}
      <div className="flex gap-3 mb-5 flex-wrap items-center">
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

        {activeTab !== 'snapshot' && (
          <button
            onClick={() => setHideInitial(v => !v)}
            className={`flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border transition-colors ${
              hideInitial
                ? 'bg-amber-50 border-amber-300 text-amber-700'
                : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
            }`}
          >
            {hideInitial ? <EyeOff size={13} /> : <Eye size={13} />}
            {hideInitial ? 'Stok awal disembunyikan' : 'Tampilkan stok awal'}
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 bg-slate-100 p-1 rounded-lg w-fit">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              activeTab === t.key
                ? 'bg-white text-slate-800 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'harian'   && <TabHarian   {...tabProps} />}
      {activeTab === 'bulanan'  && <TabBulanan  {...tabProps} />}
      {activeTab === 'tahunan'  && <TabTahunan  {...tabProps} />}
      {activeTab === 'snapshot' && <TabSnapshot {...tabProps} />}
    </div>
  )
}
