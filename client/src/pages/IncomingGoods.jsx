import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { vendorDeliveriesApi } from '../api'
import { useAuth } from '../context/AuthContext'
import PageHeader from '../components/PageHeader'
import { Table, Pagination } from '../components/Table'
import { Plus, Eye, Link2, Video } from 'lucide-react'

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

export default function IncomingGoods() {
  const navigate = useNavigate()
  const { hasPermission } = useAuth()
  const canManage = hasPermission('packing.manage') || hasPermission('packing.incoming')

  const [searchParams, setSearchParams] = useSearchParams()
  const page    = Number(searchParams.get('page')  || '1')
  const limit   = Number(searchParams.get('limit') || '15')
  const setPage = (p) => setSearchParams(prev => { prev.set('page', String(p)); return prev }, { replace: true })

  const { data, isLoading } = useQuery({
    queryKey: ['vendor-deliveries', { page, limit }],
    queryFn:  () => vendorDeliveriesApi.list({ page, limit }),
  })

  const columns = [
    { key: 'id',      label: '#',        width: 60,  render: r => <span className="font-mono text-xs text-slate-400">#{r.id}</span> },
    { key: 'date',    label: 'Tanggal',  width: 130, render: r => <span className="text-xs font-mono text-slate-500">{fmtDate(r.date)}</span> },
    { key: 'vendor',  label: 'Vendor',               render: r => <span className="font-semibold text-slate-800">{r.Vendor?.name ?? '—'}</span> },
    {
      key: 'sj', label: 'Surat Jalan', width: 120,
      render: r => r.DeliveryNote
        ? <span className="flex items-center gap-1 text-xs text-success font-medium"><Link2 size={11} /> Terhubung</span>
        : <span className="text-xs text-slate-300">—</span>,
    },
    { key: 'items',   label: 'Item',    width: 70,  render: r => <span className="font-semibold text-slate-700">{r.itemCount ?? 0}</span> },
    {
      key: 'video', label: 'Video', width: 70,
      render: r => r.videoLink
        ? <a href={r.videoLink} target="_blank" rel="noopener noreferrer" className="text-brand hover:underline flex items-center gap-1 text-xs"><Video size={12} /> Link</a>
        : <span className="text-xs text-slate-300">—</span>,
    },
    { key: 'by',      label: 'Dibuat oleh', width: 130, render: r => <span className="text-xs text-slate-500">{r.Creator?.name ?? '—'}</span> },
    {
      key: 'actions', label: '', width: 110,
      render: r => (
        <button onClick={() => navigate(`/incoming-goods/${r.id}`)} className="btn-secondary text-[10px] px-2 py-0.5 flex items-center gap-1 rounded">
          <Eye size={10} /> Lihat Detail
        </button>
      ),
    },
  ]

  return (
    <div className="px-6 py-6">
      <PageHeader
        title="Barang Masuk"
        subtitle={`${data?.pagination?.total ?? 0} transaksi`}
        action={canManage && (
          <button onClick={() => navigate('/incoming-goods/new')} className="btn-primary">
            <Plus size={14} /> Catat Barang Masuk
          </button>
        )}
      />
      <div className="card overflow-hidden">
        <Table columns={columns} data={data?.data} loading={isLoading} emptyText="Belum ada catatan barang masuk" />
        <Pagination pagination={data?.pagination} onPageChange={setPage} />
      </div>
    </div>
  )
}
