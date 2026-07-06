import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { requestApi, requestTypeApi } from '../api'
import { useAuth } from '../context/AuthContext'
import { exportExcel } from '../utils/exportExcel'
import { Plus, FileDown, Search, SlidersHorizontal, X } from 'lucide-react'

const STATUS_LABEL = {
  PENDING:  'Menunggu',
  APPROVED: 'Disetujui',
  REJECTED: 'Ditolak',
  SENT:     'Dikirim',
  DONE:     'Selesai',
}
const STATUS_COLOR = {
  PENDING:  'bg-amber-100 text-amber-700',
  APPROVED: 'bg-blue-100 text-blue-700',
  REJECTED: 'bg-red-100 text-red-700',
  SENT:     'bg-purple-100 text-purple-700',
  DONE:     'bg-emerald-100 text-emerald-700',
}

const STATUS_TABS = [
  { value: '',         label: 'Semua',    countKey: 'ALL' },
  { value: 'PENDING',  label: 'Menunggu', countKey: 'PENDING' },
  { value: 'APPROVED', label: 'Disetujui',countKey: 'APPROVED' },
  { value: 'SENT',     label: 'Dikirim',  countKey: 'SENT' },
  { value: 'DONE',     label: 'Selesai',  countKey: 'DONE' },
  { value: 'REJECTED', label: 'Ditolak',  countKey: 'REJECTED' },
]

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('id-ID', { day:'2-digit', month:'short', year:'numeric' }) : '—'

export default function Pengajuan() {
  const navigate = useNavigate()
  const { hasPermission, user } = useAuth()
  const canProcess = hasPermission('request.process') || hasPermission('request.manage') ||
                     user?.role === 'SUPER_ADMIN' || user?.role === 'COMPANY_ADMIN'

  const [searchParams, setSearchParams] = useSearchParams()
  const sp = (updates) => setSearchParams(prev => { const n = new URLSearchParams(prev); Object.entries(updates).forEach(([k,v]) => v ? n.set(k,v) : n.delete(k)); return n })

  const search        = searchParams.get('q')      || ''
  const status        = searchParams.get('status') || ''
  const requestTypeId = searchParams.get('type')   || ''
  const needsReturn   = searchParams.get('return') || ''
  const dateFrom      = searchParams.get('from')   || ''
  const dateTo        = searchParams.get('to')     || ''
  const page          = Number(searchParams.get('page') || '1')

  const [searchInput,   setSearchInput]   = useState(search)
  const [showMoreFilters, setShowMoreFilters] = useState(!!(needsReturn || dateFrom || dateTo))

  const setSearch        = (v) => sp({ q: v, page: '' })
  const setStatus        = (v) => sp({ status: v, page: '' })
  const setRequestTypeId = (v) => sp({ type: v, page: '' })
  const setNeedsReturn   = (v) => sp({ return: v, page: '' })
  const setDateFrom      = (v) => sp({ from: v, page: '' })
  const setDateTo        = (v) => sp({ to: v, page: '' })
  const setPage          = (v) => sp({ page: String(v) })

  const { data: types } = useQuery({ queryKey: ['request-types'], queryFn: requestTypeApi.list })

  const { data: counts } = useQuery({
    queryKey: ['request-status-counts', { requestTypeId, needsReturn, dateFrom, dateTo }],
    queryFn: () => requestApi.statusCounts({
      ...(requestTypeId && { requestTypeId }),
      ...(needsReturn !== '' && { needsReturn }),
      ...(dateFrom && { dateFrom }),
      ...(dateTo && { dateTo }),
    }),
    staleTime: 30_000,
  })

  const filters = {
    page, limit: 20,
    ...(search        && { search }),
    ...(status        && { status }),
    ...(requestTypeId && { requestTypeId }),
    ...(needsReturn !== '' && { needsReturn }),
    ...(dateFrom      && { dateFrom }),
    ...(dateTo        && { dateTo }),
  }

  const { data, isLoading } = useQuery({
    queryKey: ['requests', filters],
    queryFn: () => requestApi.list(filters),
    staleTime: 30_000,
  })

  const rows   = data?.data ?? []
  const total  = data?.pagination?.total ?? 0
  const pages  = Math.ceil(total / 20)

  const hasExtraFilters = needsReturn !== '' || dateFrom || dateTo

  function resetFilters() {
    setSearchInput('')
    setSearchParams(new URLSearchParams())
  }

  async function handleExport() {
    const all = await requestApi.exportData({ status, requestTypeId, dateFrom, dateTo })
    const headers = ['Tgl Pengajuan', 'Jenis', 'Pengaju', 'Divisi', 'Penerima', 'Alamat', 'Tgl Butuh', 'Status', 'Perlu Kembali', 'Tgl Kirim', 'Resi', 'Tgl Kembali', 'Produk']
    const exRows = all.map(r => [
      fmtDate(r.createdAt),
      r.requestType?.name ?? '',
      r.requestor?.name ?? '',
      r.divisi ?? '',
      r.recipientName ?? '',
      r.recipientAddress ?? '',
      fmtDate(r.neededAt),
      STATUS_LABEL[r.status] ?? r.status,
      r.needsReturn ? 'Ya' : 'Tidak',
      fmtDate(r.sentAt),
      r.trackingNumber ?? '',
      fmtDate(r.returnedAt),
      (r.items ?? []).map(i => `${i.productName}${i.variantLabel ? ' - ' + i.variantLabel : ''} (${i.qty})`).join('; '),
    ])
    exportExcel('pengajuan-stok', { headers, rows: exRows, sheetName: 'Pengajuan' })
  }

  return (
    <div className="px-6 py-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-bold text-slate-800">Pengajuan Stok</h1>
          <p className="text-xs text-slate-400 mt-0.5">Endorse, photoshoot, early access, dan lainnya</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleExport} className="btn-secondary flex items-center gap-1.5 text-sm">
            <FileDown size={14} /> Export
          </button>
          <Link to="/pengajuan/baru" className="btn-primary flex items-center gap-1.5 text-sm">
            <Plus size={14} /> Buat Pengajuan
          </Link>
        </div>
      </div>

      {/* Status tabs */}
      <div className="flex gap-1 mb-4 overflow-x-auto pb-1">
        {STATUS_TABS.map(tab => {
          const count = counts?.[tab.countKey]
          const isActive = status === tab.value
          return (
            <button
              key={tab.value}
              onClick={() => setStatus(tab.value)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all flex-shrink-0 ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700'
              }`}
            >
              {tab.label}
              {count != null && count > 0 && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none ${
                  isActive ? 'bg-white/20 text-white' : tab.value === 'PENDING' ? 'bg-amber-500 text-white' : 'bg-slate-300 text-slate-600'
                }`}>
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Search + filter bar */}
      <div className="flex gap-2 mb-4 flex-wrap items-center">
        <form onSubmit={e => { e.preventDefault(); setSearch(searchInput.trim()) }} className="flex gap-2 flex-1 min-w-0">
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              placeholder="Cari penerima / divisi…"
              className="input text-sm pl-7 w-full"
            />
          </div>
          <button type="submit" className="btn-secondary text-sm px-3">Cari</button>
        </form>

        <select
          value={requestTypeId}
          onChange={e => setRequestTypeId(e.target.value)}
          className="input text-sm w-40"
        >
          <option value="">Semua Jenis</option>
          {(types ?? []).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>

        <button
          onClick={() => setShowMoreFilters(v => !v)}
          className={`btn-secondary text-sm flex items-center gap-1.5 ${hasExtraFilters ? 'border-indigo-400 text-indigo-600' : ''}`}
        >
          <SlidersHorizontal size={13} />
          Filter
          {hasExtraFilters && <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 flex-shrink-0" />}
        </button>

        {(search || requestTypeId || hasExtraFilters) && (
          <button onClick={resetFilters} className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1">
            <X size={12} /> Reset
          </button>
        )}
      </div>

      {/* More filters panel */}
      {showMoreFilters && (
        <div className="mb-4 p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-wrap gap-3 items-end">
          <div>
            <label className="label mb-1 text-xs">Dari Tanggal</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="input text-sm w-36" />
          </div>
          <div>
            <label className="label mb-1 text-xs">Sampai Tanggal</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="input text-sm w-36" />
          </div>
          <div>
            <label className="label mb-1 text-xs">Pengembalian</label>
            <select value={needsReturn} onChange={e => setNeedsReturn(e.target.value)} className="input text-sm w-44">
              <option value="">Semua</option>
              <option value="true">↩ Perlu Dikembalikan</option>
              <option value="false">✓ Tidak Perlu Kembali</option>
            </select>
          </div>
          <button onClick={() => sp({ return: '', from: '', to: '', page: '' })}
            className="text-xs text-slate-400 hover:text-red-500 self-end pb-0.5">
            Reset filter ini
          </button>
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="th py-3 text-left">Tanggal</th>
                <th className="th py-3 text-left">Jenis</th>
                <th className="th py-3 text-left">Pengaju</th>
                <th className="th py-3 text-left">Penerima</th>
                <th className="th py-3 text-left">Produk</th>
                <th className="th py-3 text-left">Dikirim</th>
                <th className="th py-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-b border-slate-50">
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className="td py-3"><div className="h-4 bg-slate-100 rounded animate-pulse" /></td>
                    ))}
                  </tr>
                ))
              ) : rows.length === 0 ? (
                <tr><td colSpan={7} className="td py-12 text-center text-slate-400">Belum ada pengajuan</td></tr>
              ) : rows.map(r => (
                <tr key={r.id} onClick={() => navigate(`/pengajuan/${r.id}`)}
                  className="border-b border-slate-50 hover:bg-indigo-50/40 cursor-pointer transition-colors">
                  <td className="td py-2.5">
                    <div className="text-xs text-slate-700 font-mono">#{r.id}</div>
                    <div className="text-xs text-slate-500">{fmtDate(r.createdAt)}</div>
                    {r.neededAt && <div className="text-[10px] text-amber-500 mt-0.5">Butuh {fmtDate(r.neededAt)}</div>}
                  </td>
                  <td className="td py-2.5">
                    <span className="text-xs font-medium text-slate-700">{r.requestType?.name ?? '—'}</span>
                    {r.needsReturn && (
                      r.returnedAt
                        ? <div className="text-[10px] text-emerald-600 mt-0.5">↩ Kembali {fmtDate(r.returnedAt)}</div>
                        : <div className="text-[10px] text-amber-600 mt-0.5">↩ Perlu kembali</div>
                    )}
                  </td>
                  <td className="td py-2.5">
                    <div className="text-xs font-medium text-slate-700">{r.requestor?.name ?? '—'}</div>
                    {r.divisi && <div className="text-[10px] text-slate-400">{r.divisi}</div>}
                    {r.updater && r.updater.name !== r.requestor?.name && (
                      <div className="text-[10px] text-slate-400">Diedit: {r.updater.name}</div>
                    )}
                  </td>
                  <td className="td py-2.5">
                    <div className="text-xs text-slate-700 max-w-[140px] truncate">{r.recipientName || '—'}</div>
                  </td>
                  <td className="td py-2.5">
                    {(() => {
                      const hasDebt = (r.items ?? []).some(i => i.shippedQty !== null && i.shippedQty < i.qty)
                      return (
                        <div className="text-xs text-slate-500 space-y-0.5">
                          {(r.items ?? []).slice(0, 2).map((item, i) => {
                            const isP = item.shippedQty !== null && item.shippedQty < item.qty
                            return (
                              <div key={i} className="truncate max-w-[160px]">
                                {item.productName}{item.variantLabel ? ` · ${item.variantLabel}` : ''}{' '}
                                {isP
                                  ? <span className="text-amber-600 font-medium">{item.shippedQty}/{item.qty}</span>
                                  : <span className="text-slate-400">×{item.qty}</span>
                                }
                              </div>
                            )
                          })}
                          {(r.items ?? []).length > 2 && (
                            <div className="text-slate-400">+{r.items.length - 2} lainnya</div>
                          )}
                          {hasDebt && (
                            <div className="text-[10px] text-amber-600 font-medium mt-0.5">⚠ Hutang stok</div>
                          )}
                        </div>
                      )
                    })()}
                  </td>
                  <td className="td py-2.5">
                    {r.sentAt ? (
                      <div>
                        <div className="text-xs text-purple-600 font-medium">{fmtDate(r.sentAt)}</div>
                        {r.trackingNumber && <div className="text-[10px] text-slate-400 font-mono">{r.trackingNumber}</div>}
                      </div>
                    ) : (
                      <span className="text-xs text-slate-300">—</span>
                    )}
                  </td>
                  <td className="td py-2.5 text-center" onClick={e => e.stopPropagation()}>
                    <Link to={`/pengajuan/${r.id}`}>
                      <span className={`text-xs font-medium px-2 py-1 rounded-full border ${STATUS_COLOR[r.status]}`}>
                        {STATUS_LABEL[r.status]}
                      </span>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
          <span className="text-xs text-slate-400">{total} pengajuan</span>
          {pages > 1 && (
            <div className="flex items-center gap-1">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="w-7 h-7 text-xs rounded text-slate-500 hover:bg-slate-100 disabled:opacity-30">‹</button>
              {Array.from({ length: Math.min(pages, 7) }, (_, i) => {
                const p = pages <= 7 ? i + 1 : page <= 4 ? i + 1 : page >= pages - 3 ? pages - 6 + i : page - 3 + i
                return (
                  <button key={p} onClick={() => setPage(p)}
                    className={`w-7 h-7 text-xs rounded ${p === page ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>
                    {p}
                  </button>
                )
              })}
              <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages}
                className="w-7 h-7 text-xs rounded text-slate-500 hover:bg-slate-100 disabled:opacity-30">›</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
