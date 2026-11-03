import { useEffect, useState } from 'react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { Plus, Search, X, ArrowRight, ChevronRight, CalendarDays } from 'lucide-react'
import { stockTransfersApi, warehousesApi } from '../api'
import PageHeader from '../components/PageHeader'
import { Table, Pagination } from '../components/Table'
import { useAuth } from '../context/AuthContext'
import { TRANSFER_TYPES, TYPE_STYLE, typeLabel, transferNo, fmtDate } from './transferShared'

const FILTER_KEYS = ['q', 'warehouseId', 'transferType', 'dateFrom', 'dateTo']

export default function Transfers() {
  const navigate = useNavigate()
  const location = useLocation()
  const { hasPermission, isSuperAdmin } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()

  const page  = Number(searchParams.get('page') || '1')
  const limit = Number(searchParams.get('limit')) || 10
  const filters = Object.fromEntries(FILTER_KEYS.map(k => [k, searchParams.get(k) || '']))
  const activeFilters = FILTER_KEYS.filter(k => filters[k]).length

  const setFilter = (key, value) => setSearchParams(prev => {
    if (value) prev.set(key, value); else prev.delete(key)
    prev.set('page', '1')
    return prev
  }, { replace: true })

  // Kolom cari diketik bebas, baru dikirim ke server setelah berhenti mengetik
  const [q, setQ] = useState(filters.q)
  useEffect(() => {
    if (q.trim() === filters.q) return
    const t = setTimeout(() => setFilter('q', q.trim()), 350)
    return () => clearTimeout(t)
  }, [q]) // eslint-disable-line react-hooks/exhaustive-deps
  const resetFilters = () => { setQ(''); setSearchParams(prev => { FILTER_KEYS.forEach(k => prev.delete(k)); prev.set('page', '1'); return prev }, { replace: true }) }

  const params = { page, limit, ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)) }
  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['transfers', params],
    queryFn:  () => stockTransfersApi.list(params),
    placeholderData: keepPreviousData,
  })
  const { data: whRes } = useQuery({
    queryKey: ['warehouses', { limit: 100 }],
    queryFn:  () => warehousesApi.list({ limit: 100 }),
  })
  const warehouses = whRes?.data ?? []

  const canCreate = isSuperAdmin || hasPermission('stock.transfer.create') || hasPermission('stock.transfer.manage')
  const total = data?.pagination?.total ?? 0

  const columns = [
    {
      key: 'no', label: 'No. Transfer', width: 150,
      render: r => (
        <div>
          <p className="font-mono text-[13px] font-bold text-slate-800">{transferNo(r.id)}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">{fmtDate(r.date)}</p>
        </div>
      ),
    },
    {
      key: 'route', label: 'Rute',
      render: r => (
        <div className="flex items-center gap-2 min-w-[220px]">
          <span className="text-sm font-medium text-slate-700">{r.FromWarehouse?.name ?? '—'}</span>
          <ArrowRight size={14} className="text-slate-300 shrink-0" />
          <span className="text-sm font-medium text-slate-700">{r.ToWarehouse?.name ?? '—'}</span>
        </div>
      ),
    },
    {
      key: 'type', label: 'Tipe', width: 170,
      render: r => (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border whitespace-nowrap ${TYPE_STYLE[r.transferType] ?? TYPE_STYLE.LAINNYA}`}>
          {typeLabel(r.transferType, true)}
        </span>
      ),
    },
    {
      key: 'qty', label: 'Isi', width: 130,
      render: r => (
        <div className="whitespace-nowrap">
          <span className="text-sm font-bold text-slate-800 tabular-nums">{r.totalQty ?? '—'} pcs</span>
          <span className="text-xs text-slate-400"> · {r.itemCount} SKU</span>
        </div>
      ),
    },
    {
      key: 'note', label: 'Catatan',
      render: r => <span className="text-xs text-slate-500 line-clamp-2 max-w-[220px]" title={r.note || ''}>{r.note || <span className="text-slate-300">—</span>}</span>,
    },
    {
      key: 'creator', label: 'Dibuat oleh', width: 130,
      render: r => (
        <div>
          <div className="text-xs text-slate-600">{r.Creator?.name ?? '—'}</div>
          {r.updater && r.updater.name !== r.Creator?.name && (
            <div className="text-[10px] text-slate-400">Diedit: {r.updater.name}</div>
          )}
        </div>
      ),
    },
    {
      key: 'open', label: '', width: 80,
      render: () => (
        <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-slate-400 group-hover:text-red-700 whitespace-nowrap">
          Detail <ChevronRight size={14} />
        </span>
      ),
    },
  ]

  return (
    <div className="px-6 py-6 space-y-4">
      <PageHeader
        title="Transfer Stok"
        subtitle="Riwayat perpindahan stok antar gudang. Klik transaksi untuk melihat isi & cross-check barang."
        action={
          canCreate && (
            <button onClick={() => navigate('/transfers/new')} className="btn-primary flex items-center gap-2">
              <Plus size={15} />
              Transfer Baru
            </button>
          )
        }
      />

      {/* ── Filter ─────────────────────────────────────────── */}
      <div className="card p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[240px]">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className="input pl-9 pr-8"
              value={q}
              onChange={e => setQ(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') setFilter('q', q.trim()) }}
              placeholder="Cari no. transfer (TRF-00012), nama produk, kode SKU, atau catatan…"
            />
            {q && (
              <button type="button" onClick={() => { setQ(''); setFilter('q', '') }} aria-label="Hapus pencarian"
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100">
                <X size={13} />
              </button>
            )}
          </div>
          <select className="select w-auto min-w-[170px]" value={filters.warehouseId} onChange={e => setFilter('warehouseId', e.target.value)} aria-label="Filter gudang">
            <option value="">Semua gudang</option>
            {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
          <select className="select w-auto min-w-[170px]" value={filters.transferType} onChange={e => setFilter('transferType', e.target.value)} aria-label="Filter tipe">
            <option value="">Semua tipe</option>
            {TRANSFER_TYPES.map(t => <option key={t.value} value={t.value}>{t.short}</option>)}
          </select>
          <div className="flex items-center gap-1.5">
            <CalendarDays size={15} className="text-slate-400" />
            <input type="date" className="input w-auto" value={filters.dateFrom} max={filters.dateTo || undefined}
              onChange={e => setFilter('dateFrom', e.target.value)} aria-label="Dari tanggal" />
            <span className="text-xs text-slate-400">s/d</span>
            <input type="date" className="input w-auto" value={filters.dateTo} min={filters.dateFrom || undefined}
              onChange={e => setFilter('dateTo', e.target.value)} aria-label="Sampai tanggal" />
          </div>
          {activeFilters > 0 && (
            <button type="button" onClick={resetFilters} className="btn-ghost text-xs">
              <X size={13} /> Reset filter
            </button>
          )}
        </div>
        <p className="text-xs text-slate-400 mt-2 px-1">
          {isLoading ? 'Memuat…' : <>
            <b className="text-slate-600">{total}</b> transfer{activeFilters > 0 && ' sesuai filter'}
            {isFetching && !isLoading && <span className="ml-2 text-slate-300">memperbarui…</span>}
          </>}
        </p>
      </div>

      <div className="card overflow-hidden">
        <Table
          columns={columns}
          data={data?.data}
          loading={isLoading}
          emptyText={activeFilters ? 'Tidak ada transfer yang cocok dengan filter' : 'Belum ada transfer stok'}
          onRowClick={r => navigate(`/transfers/${r.id}`, { state: { fromSearch: location.search } })}
        />
        <Pagination
          pagination={data?.pagination}
          onPageChange={p => setSearchParams(prev => { prev.set('page', String(p)); return prev }, { replace: true })}
        />
      </div>
    </div>
  )
}
