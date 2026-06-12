import { useQuery } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { stockTransfersApi } from '../api'
import PageHeader from '../components/PageHeader'
import { Table, Pagination } from '../components/Table'
import { useAuth } from '../context/AuthContext'

const TYPE_LABELS = {
  TRANSFER:              'Transfer Biasa',
  QC_REJECT_SEMENTARA:   'QC Reject → Sementara',
  QC_REJECT_PERMANEN:    'QC Reject → Permanen',
  LAINNYA:               'Lainnya',
}

const TYPE_STYLE = {
  TRANSFER:              'bg-blue-50 text-blue-700 border-blue-100',
  QC_REJECT_SEMENTARA:   'bg-amber-50 text-amber-700 border-amber-100',
  QC_REJECT_PERMANEN:    'bg-red-50 text-red-700 border-red-100',
  LAINNYA:               'bg-slate-50 text-slate-600 border-slate-200',
}

export default function Transfers() {
  const navigate = useNavigate()
  const { hasPermission, isSuperAdmin } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()

  const page  = Number(searchParams.get('page') || '1')
  const limit = 15

  const { data, isLoading } = useQuery({
    queryKey: ['transfers', { page, limit }],
    queryFn:  () => stockTransfersApi.list({ page, limit }),
  })

  const canCreate = isSuperAdmin || hasPermission('stock.transfer.create') || hasPermission('stock.transfer.manage')

  const columns = [
    {
      key: 'date', label: 'Tanggal', width: 120,
      render: r => <span className="text-xs text-slate-500">{new Date(r.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}</span>,
    },
    {
      key: 'type', label: 'Tipe Transfer', width: 200,
      render: r => (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${TYPE_STYLE[r.transferType] ?? TYPE_STYLE.LAINNYA}`}>
          {TYPE_LABELS[r.transferType] ?? r.transferType}
        </span>
      ),
    },
    {
      key: 'from', label: 'Gudang Asal',
      render: r => <span className="text-sm text-slate-700 font-medium">{r.FromWarehouse?.name ?? '—'}</span>,
    },
    {
      key: 'arrow', label: '', width: 24,
      render: () => <span className="text-slate-300 text-base">→</span>,
    },
    {
      key: 'to', label: 'Gudang Tujuan',
      render: r => <span className="text-sm text-slate-700 font-medium">{r.ToWarehouse?.name ?? '—'}</span>,
    },
    {
      key: 'items', label: 'Jumlah Item', width: 100,
      render: r => <span className="text-sm font-mono text-slate-600">{r.itemCount} item</span>,
    },
    {
      key: 'note', label: 'Catatan',
      render: r => <span className="text-xs text-slate-400 truncate max-w-[160px] block">{r.note || '—'}</span>,
    },
    {
      key: 'creator', label: 'Dibuat oleh', width: 120,
      render: r => <span className="text-xs text-slate-500">{r.Creator?.name ?? '—'}</span>,
    },
  ]

  return (
    <div className="px-6 py-6 space-y-5">
      <PageHeader
        title="Transfer Stok"
        subtitle={`${data?.pagination?.total ?? 0} transfer`}
        action={
          canCreate && (
            <button onClick={() => navigate('/transfers/new')} className="btn-primary flex items-center gap-2">
              <Plus size={15} />
              Transfer Baru
            </button>
          )
        }
      />

      <div className="card overflow-hidden">
        <Table
          columns={columns}
          data={data?.data}
          loading={isLoading}
          emptyText="Belum ada transfer stok"
          onRowClick={r => navigate(`/transfers/${r.id}`)}
        />
        <Pagination
          pagination={data?.pagination}
          onPageChange={p => setSearchParams(prev => { prev.set('page', String(p)); return prev }, { replace: true })}
        />
      </div>
    </div>
  )
}
