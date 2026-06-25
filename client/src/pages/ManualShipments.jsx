import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Plus, ShoppingCart, Gift, Search } from 'lucide-react'
import { manualShipmentsApi } from '../api'
import PageHeader from '../components/PageHeader'
import { Table, Pagination } from '../components/Table'
import { useAuth } from '../context/AuthContext'

const STATUS_BADGE = {
  pending:   <span className="badge-amber">● Unpaid</span>,
  paid:      <span className="badge-indigo">● Paid</span>,
  shipped:   <span className="badge-purple">● Shipped</span>,
  completed: <span className="badge-green">● Completed</span>,
  cancelled: <span className="badge-red">● Cancelled</span>,
}

const TYPE_BADGE = {
  sales:     <span className="badge-teal flex items-center gap-1"><ShoppingCart size={10} /> Sales</span>,
  non_sales: <span className="badge-muted flex items-center gap-1"><Gift size={10} /> Non-Sales</span>,
}

const fmtDate = d => d ? new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
const fmtRp   = n => n == null ? '—' : 'Rp ' + Number(n).toLocaleString('id-ID')

const TYPE_TABS = [
  { value: '', label: 'Semua' },
  { value: 'sales', label: 'Sales' },
  { value: 'non_sales', label: 'Non-Sales' },
]

const STATUS_OPTS = [
  { value: '',          label: 'Semua Status' },
  { value: 'pending',   label: 'Unpaid' },
  { value: 'paid',      label: 'Paid' },
  { value: 'shipped',   label: 'Shipped' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
]

export default function ManualShipments() {
  const navigate = useNavigate()
  const { hasPermission, isSuperAdmin } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()

  const page   = Number(searchParams.get('page')   || '1')
  const type   = searchParams.get('type')   || ''
  const status = searchParams.get('status') || ''
  const search = searchParams.get('search') || ''

  const [searchInput, setSearchInput] = useState(search)

  const canCreate = isSuperAdmin || hasPermission('shipping.manual.create') || hasPermission('shipping.manual.manage')

  const { data, isLoading } = useQuery({
    queryKey: ['manual-shipments', { page, type, status, search }],
    queryFn:  () => manualShipmentsApi.list({ page, limit: 15, type: type || undefined, status: status || undefined, search: search || undefined }),
  })

  const setParam = (key, val) => setSearchParams(prev => {
    if (val) prev.set(key, val); else prev.delete(key)
    if (key !== 'page') prev.delete('page')
    return prev
  }, { replace: true })

  const handleSearch = e => {
    e.preventDefault()
    setParam('search', searchInput.trim())
  }

  const columns = [
    {
      key: 'invoice', label: 'Invoice',
      render: r => <span className="font-mono text-xs font-semibold text-slate-700">{r.invoiceNumber}</span>,
    },
    {
      key: 'type', label: 'Tipe', width: 110,
      render: r => TYPE_BADGE[r.type] ?? <span className="badge-muted">{r.type}</span>,
    },
    {
      key: 'buyer', label: 'Pembeli / Penerima',
      render: r => (
        <div>
          <div className="text-sm font-medium text-slate-800 truncate max-w-[180px]">
            {r.buyerName || r.recipientInfo || '—'}
          </div>
          {r.category && <div className="text-xs text-slate-400">{r.category.name}</div>}
        </div>
      ),
    },
    {
      key: 'status', label: 'Status', width: 130,
      render: r => STATUS_BADGE[r.status] ?? <span className="badge-muted">{r.status}</span>,
    },
    {
      key: 'expedition', label: 'Ekspedisi', width: 120,
      render: r => <span className="text-xs text-slate-500">{r.expeditionName || '—'}</span>,
    },
    {
      key: 'total', label: 'Total', width: 130,
      render: r => (
        <span className="text-sm font-semibold text-slate-700">
          {r.type === 'non_sales' && Number(r.total) === 0 ? '—' : fmtRp(r.total)}
        </span>
      ),
    },
    {
      key: 'items', label: 'Items', width: 70,
      render: r => <span className="text-xs font-mono text-slate-500">{r.itemCount} pcs</span>,
    },
    {
      key: 'date', label: 'Tanggal', width: 110,
      render: r => <span className="text-xs text-slate-400">{fmtDate(r.createdAt)}</span>,
    },
    {
      key: 'creator', label: 'Dibuat oleh', width: 130,
      render: r => (
        <div>
          <div className="text-xs text-slate-500">{r.creator?.name ?? '—'}</div>
          {r.updater && r.updater.name !== r.creator?.name && (
            <div className="text-[10px] text-slate-400">Diedit: {r.updater.name}</div>
          )}
          {r.submitter && <div className="text-[10px] text-blue-500">Dikirim: {r.submitter.name}</div>}
        </div>
      ),
    },
    {
      key: 'action', label: '', width: 60,
      render: r => (
        <button
          onClick={e => { e.stopPropagation(); navigate(`/shipping-manual/${r.id}`) }}
          className="btn-secondary text-xs px-2 py-1"
        >
          Lihat
        </button>
      ),
    },
  ]

  return (
    <div className="px-6 py-6 space-y-5">
      <PageHeader
        title="Shipping Manual"
        subtitle={`${data?.pagination?.total ?? 0} transaksi`}
        action={
          canCreate && (
            <button onClick={() => navigate('/shipping-manual/new')} className="btn-primary flex items-center gap-2">
              <Plus size={15} /> Buat Shipping
            </button>
          )
        }
      />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        {/* Type tabs */}
        <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
          {TYPE_TABS.map(t => (
            <button
              key={t.value}
              onClick={() => setParam('type', t.value)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                type === t.value
                  ? 'bg-white text-slate-800 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Status filter */}
        <select
          value={status}
          onChange={e => setParam('status', e.target.value)}
          className="input text-sm h-9 py-0 w-44"
        >
          {STATUS_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>

        {/* Search */}
        <form onSubmit={handleSearch} className="flex gap-2 ml-auto">
          <input
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            placeholder="Cari invoice / nama..."
            className="input text-sm h-9 py-0 w-56"
          />
          <button type="submit" className="btn-secondary h-9 px-3 flex items-center gap-1">
            <Search size={14} />
          </button>
        </form>
      </div>

      <div className="card overflow-hidden">
        <Table
          columns={columns}
          data={data?.data}
          loading={isLoading}
          emptyText="Belum ada transaksi shipping manual"
          onRowClick={r => navigate(`/shipping-manual/${r.id}`)}
        />
        <Pagination
          pagination={data?.pagination}
          onPageChange={p => setParam('page', String(p))}
        />
      </div>
    </div>
  )
}
