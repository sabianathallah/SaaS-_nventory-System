import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { stockOutApi, stockOutDraftApi, warehousesApi } from '../api'
import { useAuth } from '../context/AuthContext'
import PageHeader from '../components/PageHeader'
import { Table, Pagination } from '../components/Table'
import { useCompanyGuard } from '../hooks/useCompanyGuard'
import CompanyRequiredBanner from '../components/CompanyRequiredBanner'
import toast from 'react-hot-toast'
import { PackageMinus, Eye, PencilLine, X, Search, StickyNote } from 'lucide-react'

const WH_KEY = 'stockout_warehouse_filter'

const fmt = (n) => Number(n ?? 0).toLocaleString('id-ID')
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

export default function StockOut() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const page       = Number(searchParams.get('page')  || '1')
  const limit      = Number(searchParams.get('limit') || '10')
  const search     = searchParams.get('q')     || ''
  const noteSearch = searchParams.get('noteq') || ''
  const setPage = (p) => setSearchParams(prev => { prev.set('page', String(p)); return prev }, { replace: true })
  const [searchInput, setSearchInput] = useState(search)
  const [noteInput,   setNoteInput]   = useState(noteSearch)
  const handleSearch = (e) => {
    e.preventDefault()
    setSearchParams(prev => {
      const q = searchInput.trim(); const n = noteInput.trim()
      if (q) prev.set('q', q);     else prev.delete('q')
      if (n) prev.set('noteq', n); else prev.delete('noteq')
      prev.delete('page')
      return prev
    }, { replace: true })
  }
  const { hasPermission, user } = useAuth()

  const canCreate    = hasPermission('stock.out.create') || hasPermission('stock.manage')
  const canViewValue = hasPermission('inventory.view_value') || hasPermission('inventory.manage')
  const { needsCompany } = useCompanyGuard()

  const [warehouseFilter, setWarehouseFilter] = useState(() => localStorage.getItem(WH_KEY) || '')
  const handleWarehouseChange = (val) => {
    setWarehouseFilter(val)
    val ? localStorage.setItem(WH_KEY, val) : localStorage.removeItem(WH_KEY)
    setPage(1)
  }

  const { data: warehouses } = useQuery({
    queryKey: ['warehouses', { limit: 100 }],
    queryFn:  () => warehousesApi.list({ limit: 100 }),
  })

  const { data, isLoading } = useQuery({
    queryKey: ['stock-out', { page, limit, WarehouseId: warehouseFilter || undefined, search, noteSearch }],
    queryFn:  () => stockOutApi.list({ page, limit, WarehouseId: warehouseFilter || undefined, search: search || undefined, noteSearch: noteSearch || undefined }),
  })

  const { data: drafts = [] } = useQuery({
    queryKey: ['stock-out-draft-current'],
    queryFn:  () => stockOutDraftApi.current(),
    enabled:  canCreate,
  })

  const newSession = useMutation({
    mutationFn: () => stockOutDraftApi.create(),
    onSuccess: (draft) => navigate(`/stock-out/new?draftId=${draft.id}`),
    onError: () => toast.error('Gagal membuat session baru'),
  })

  const cancelDraft = useMutation({
    mutationFn: (id) => stockOutDraftApi.cancel(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stock-out-draft-current'] })
      qc.removeQueries({ queryKey: ['stock-out-draft'] })
      toast.success('Session dibatalkan')
    },
    onError: () => toast.error('Gagal membatalkan session'),
  })

  const draftRows = drafts.map(draft => ({
    _isDraft:   true,
    _draftId:   draft.id,
    id:         `draft-${draft.id}`,
    date:       draft.date,
    Warehouse:  draft.Warehouse,
    purpose:    draft.purpose || '',
    notes:      draft.note   || '',
    itemCount:  draft.Stock_Out_Draft_Items?.length ?? 0,
    totalQty:   draft.Stock_Out_Draft_Items?.reduce((s, i) => s + (i.quantity ?? 0), 0) ?? 0,
    grandTotal: draft.Stock_Out_Draft_Items?.reduce((s, i) => s + (i.quantity ?? 0) * (i.price ?? 0), 0) ?? 0,
    User:       draft.User ?? { name: user?.name },
  }))

  const tableData = [...draftRows, ...(data?.data ?? [])]

  const columns = [
    {
      key: 'id', label: 'No.', width: 90,
      render: r => r._isDraft
        ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-700 border border-amber-200 whitespace-nowrap">● Aktif</span>
        : <span className="font-mono text-xs font-semibold text-slate-400">#{r.id}</span>,
    },
    {
      key: 'date', label: 'Tanggal', width: 120,
      render: r => <span className="text-xs font-mono text-slate-500">{fmtDate(r.date ?? r.createdAt)}</span>,
    },
    {
      key: 'warehouse', label: 'Gudang',
      render: r => <span className="font-semibold text-slate-800">{r.Warehouse?.name ?? '—'}</span>,
    },
    {
      key: 'purpose', label: 'Tujuan',
      render: r => r.purpose
        ? <span className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold bg-violet-50 text-violet-700 border border-violet-100 truncate max-w-[140px]">{r.purpose}</span>
        : <span className="text-xs text-slate-400">—</span>,
    },
    {
      key: 'itemCount', label: 'Item', width: 60,
      render: r => <span className="text-sm font-semibold text-slate-700">{r.itemCount ?? 0}</span>,
    },
    {
      key: 'totalQty', label: 'Total Qty', width: 90,
      render: r => <span className="font-mono text-sm text-danger font-bold">{fmt(r.totalQty ?? 0)}</span>,
    },
    ...(canViewValue ? [{
      key: 'grandTotal', label: 'Total Nilai', width: 150,
      render: r => <span className="font-mono font-bold text-sm text-slate-800">Rp {fmt(r.grandTotal ?? 0)}</span>,
    }] : []),
    {
      key: 'createdBy', label: 'Dibuat oleh', width: 130,
      render: r => (
        <div>
          <div className="text-xs text-slate-500">{r.User?.name ?? '—'}</div>
          {r.updater && r.updater.name !== r.User?.name && (
            <div className="text-[10px] text-slate-400">Diedit: {r.updater.name}</div>
          )}
        </div>
      ),
    },
    {
      key: 'notes', label: 'Catatan',
      render: r => <span className="text-xs text-slate-400 truncate max-w-[150px] block">{r.notes || '—'}</span>,
    },
    {
      key: 'actions', label: '', width: 180,
      render: r => r._isDraft ? (
        <div className="flex gap-1.5">
          <button
            onClick={() => navigate(`/stock-out/new?draftId=${r._draftId}`)}
            className="flex items-center gap-1 text-[10px] px-2.5 py-1 rounded font-semibold bg-amber-500 text-white hover:bg-amber-600 transition-colors"
          >
            <PencilLine size={10} /> Isi Session
          </button>
          <button
            onClick={() => { if (confirm('Batalkan session ini? Semua item akan dihapus.')) cancelDraft.mutate(r._draftId) }}
            disabled={cancelDraft.isPending}
            className="flex items-center gap-1 text-[10px] px-2 py-1 rounded font-medium text-slate-500 hover:text-red-500 hover:bg-red-50 border border-slate-200 transition-colors"
          >
            <X size={10} /> Batal
          </button>
        </div>
      ) : (
        <button onClick={() => navigate(`/stock-out/${r.id}`)} className="btn-secondary text-[10px] px-2 py-0.5 flex items-center gap-1 rounded">
          <Eye size={10} /> Lihat Detail
        </button>
      ),
    },
  ]

  return (
    <div className="px-6 py-6">
      {needsCompany && <div className="mb-4"><CompanyRequiredBanner action="membuat sesi pengeluaran stok" /></div>}
      <PageHeader
        title="Pengeluaran Stok"
        subtitle={`${data?.pagination?.total ?? 0} transaksi`}
        action={canCreate && (
          <button
            onClick={() => newSession.mutate()}
            disabled={newSession.isPending}
            className="btn-primary disabled:opacity-50"
          >
            <PackageMinus size={14} /> {newSession.isPending ? 'Membuat…' : 'Pengeluaran Baru'}
          </button>
        )}
      />
      <div className="mb-3 flex gap-2 flex-wrap items-center">
        <select
          value={warehouseFilter}
          onChange={e => handleWarehouseChange(e.target.value)}
          className="input text-sm w-48"
        >
          <option value="">Semua Gudang</option>
          {(warehouses?.data ?? []).map(w => (
            <option key={w.id} value={w.id}>{w.name}</option>
          ))}
        </select>
        <form onSubmit={handleSearch} className="flex gap-2 flex-wrap">
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              placeholder="Cari tujuan / produk…"
              className="input text-sm pl-7 w-52"
            />
          </div>
          <div className="relative">
            <StickyNote size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-amber-400" />
            <input
              value={noteInput}
              onChange={e => setNoteInput(e.target.value)}
              placeholder="Cari di catatan…"
              className="input text-sm pl-7 w-44"
            />
          </div>
          <button type="submit" className="btn-secondary text-sm px-3">Cari</button>
        </form>
      </div>
      <div className="card overflow-hidden">
        <Table columns={columns} data={tableData} loading={isLoading} emptyText="Belum ada transaksi stock out" />
        <Pagination pagination={data?.pagination} onPageChange={setPage} />
      </div>
    </div>
  )
}
