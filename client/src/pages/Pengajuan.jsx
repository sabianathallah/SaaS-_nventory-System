import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { requestApi, requestTypeApi } from '../api'
import { useAuth } from '../context/AuthContext'
import { exportExcel } from '../utils/exportExcel'
import { Plus, FileDown, Search } from 'lucide-react'

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

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('id-ID', { day:'2-digit', month:'short', year:'numeric' }) : '—'

export default function Pengajuan() {
  const navigate = useNavigate()
  const { hasPermission, user } = useAuth()
  const canProcess = hasPermission('request.process') || hasPermission('request.manage')

  const [search,        setSearch]        = useState('')
  const [status,        setStatus]        = useState('')
  const [requestTypeId, setRequestTypeId] = useState('')
  const [needsReturn,   setNeedsReturn]   = useState('')
  const [dateFrom,      setDateFrom]      = useState('')
  const [dateTo,        setDateTo]        = useState('')
  const [page,          setPage]          = useState(1)

  const { data: types } = useQuery({ queryKey: ['request-types'], queryFn: requestTypeApi.list })

  const filters = {
    page, limit: 20,
    ...(search        && { search }),
    ...(status        && { status }),
    ...(requestTypeId && { requestTypeId }),
    ...(needsReturn   !== '' && { needsReturn }),
    ...(dateFrom      && { dateFrom }),
    ...(dateTo        && { dateTo }),
  }

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['requests', filters],
    queryFn: () => requestApi.list(filters),
    staleTime: 30_000,
  })

  const rows   = data?.data ?? []
  const total  = data?.pagination?.total ?? 0
  const pages  = Math.ceil(total / 20)

  async function handleExport() {
    const all = await requestApi.exportData({ status, requestTypeId, dateFrom, dateTo })
    const headers = ['Tgl Pengajuan', 'Jenis', 'Pengaju', 'Divisi', 'Penerima', 'Alamat', 'Tgl Butuh', 'Status', 'Perlu Kembali', 'Tgl Kirim', 'Resi', 'Tgl Kembali', 'Produk']
    const rows = all.map(r => [
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
    exportExcel('pengajuan-stok', { headers, rows, sheetName: 'Pengajuan' })
  }

  return (
    <div className="px-6 py-6 max-w-6xl">
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

      {/* Filters */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
            placeholder="Cari penerima / divisi…" className="input text-sm pl-7 w-52" />
        </div>
        <select value={requestTypeId} onChange={e => { setRequestTypeId(e.target.value); setPage(1) }} className="input text-sm w-40">
          <option value="">Semua Jenis</option>
          {(types ?? []).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <select value={status} onChange={e => { setStatus(e.target.value); setPage(1) }} className="input text-sm w-40">
          <option value="">Semua Status</option>
          {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1) }} className="input text-sm w-36" />
        <input type="date" value={dateTo}   onChange={e => { setDateTo(e.target.value);   setPage(1) }} className="input text-sm w-36" />
        <select value={needsReturn} onChange={e => { setNeedsReturn(e.target.value); setPage(1) }} className="input text-sm w-44">
          <option value="">Semua (kembali/tidak)</option>
          <option value="true">↩ Perlu Dikembalikan</option>
          <option value="false">✓ Tidak Perlu Kembali</option>
        </select>
        {(search || status || requestTypeId || needsReturn !== '' || dateFrom || dateTo) && (
          <button onClick={() => { setSearch(''); setStatus(''); setRequestTypeId(''); setNeedsReturn(''); setDateFrom(''); setDateTo(''); setPage(1) }}
            className="text-xs text-slate-400 hover:text-slate-600 px-2">Reset</button>
        )}
      </div>

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
                    {r.needsReturn && <div className="text-[10px] text-amber-600 mt-0.5">↩ Perlu kembali</div>}
                  </td>
                  <td className="td py-2.5">
                    <div className="text-xs font-medium text-slate-700">{r.requestor?.name ?? '—'}</div>
                    {r.divisi && <div className="text-[10px] text-slate-400">{r.divisi}</div>}
                  </td>
                  <td className="td py-2.5">
                    <div className="text-xs text-slate-700 max-w-[140px] truncate">{r.recipientName || '—'}</div>
                  </td>
                  <td className="td py-2.5">
                    <div className="text-xs text-slate-500 space-y-0.5">
                      {(r.items ?? []).slice(0, 2).map((item, i) => (
                        <div key={i} className="truncate max-w-[160px]">
                          {item.productName}{item.variantLabel ? ` · ${item.variantLabel}` : ''} <span className="text-slate-400">×{item.qty}</span>
                        </div>
                      ))}
                      {(r.items ?? []).length > 2 && (
                        <div className="text-slate-400">+{r.items.length - 2} lainnya</div>
                      )}
                    </div>
                  </td>
                  <td className="td py-2.5">
                    {r.sentAt ? (
                      <div>
                        <div className="text-xs text-purple-600 font-medium">{fmtDate(r.sentAt)}</div>
                        {r.trackingNumber && <div className="text-[10px] text-slate-400 font-mono">{r.trackingNumber}</div>}
                        {r.returnedAt && <div className="text-[10px] text-emerald-600 mt-0.5">↩ {fmtDate(r.returnedAt)}</div>}
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
