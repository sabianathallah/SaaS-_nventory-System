import { useState } from 'react'
import { Link } from 'react-router-dom'
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
  const { hasPermission, user } = useAuth()
  const canProcess = hasPermission('request.process') || hasPermission('request.manage')

  const [search,        setSearch]        = useState('')
  const [status,        setStatus]        = useState('')
  const [requestTypeId, setRequestTypeId] = useState('')
  const [dateFrom,      setDateFrom]      = useState('')
  const [dateTo,        setDateTo]        = useState('')
  const [page,          setPage]          = useState(1)

  const { data: types } = useQuery({ queryKey: ['request-types'], queryFn: requestTypeApi.list })

  const filters = {
    page, limit: 20,
    ...(search        && { search }),
    ...(status        && { status }),
    ...(requestTypeId && { requestTypeId }),
    ...(dateFrom      && { dateFrom }),
    ...(dateTo        && { dateTo }),
  }

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['requests', filters],
    queryFn: () => requestApi.list(filters),
    staleTime: 30_000,
  })

  const rows   = data?.data ?? []
  const total  = data?.total ?? 0
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
        {(search || status || requestTypeId || dateFrom || dateTo) && (
          <button onClick={() => { setSearch(''); setStatus(''); setRequestTypeId(''); setDateFrom(''); setDateTo(''); setPage(1) }}
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
                <th className="th py-3 text-center">Kembali?</th>
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
                <tr key={r.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                  <td className="td py-2.5">
                    <div className="text-xs text-slate-700">{fmtDate(r.createdAt)}</div>
                    {r.neededAt && <div className="text-xs text-slate-400">Butuh: {fmtDate(r.neededAt)}</div>}
                  </td>
                  <td className="td py-2.5">
                    <span className="text-xs font-medium text-slate-700">{r.requestType?.name}</span>
                  </td>
                  <td className="td py-2.5">
                    <div className="text-xs font-medium text-slate-700">{r.requestor?.name}</div>
                    {r.divisi && <div className="text-xs text-slate-400">{r.divisi}</div>}
                  </td>
                  <td className="td py-2.5">
                    <div className="text-xs text-slate-700 max-w-[140px] truncate">{r.recipientName || '—'}</div>
                  </td>
                  <td className="td py-2.5">
                    <div className="text-xs text-slate-500">
                      {(r.items ?? []).slice(0, 2).map((item, i) => (
                        <div key={i}>{item.productName}{item.variantLabel ? ` · ${item.variantLabel}` : ''} ×{item.qty}</div>
                      ))}
                      {(r.items ?? []).length > 2 && <div className="text-slate-400">+{r.items.length - 2} lainnya</div>}
                    </div>
                  </td>
                  <td className="td py-2.5 text-center">
                    <span className={`text-xs px-1.5 py-0.5 rounded ${r.needsReturn ? 'bg-amber-50 text-amber-600' : 'bg-slate-100 text-slate-400'}`}>
                      {r.needsReturn ? 'Ya' : 'Tidak'}
                    </span>
                  </td>
                  <td className="td py-2.5 text-center">
                    <div className="flex flex-col items-center gap-1">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLOR[r.status]}`}>
                        {STATUS_LABEL[r.status]}
                      </span>
                      <Link to={`/pengajuan/${r.id}`} className="text-xs text-indigo-500 hover:underline">Detail</Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
            <span className="text-xs text-slate-400">{total} pengajuan</span>
            <div className="flex gap-1">
              {Array.from({ length: pages }, (_, i) => i + 1).map(p => (
                <button key={p} onClick={() => setPage(p)}
                  className={`w-7 h-7 text-xs rounded ${p === page ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
