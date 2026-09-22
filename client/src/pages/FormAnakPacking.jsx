import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { formAnakPackingApi } from '../api'
import PageHeader from '../components/PageHeader'
import { Table, Pagination } from '../components/Table'
import Modal from '../components/Modal'
import { Eye } from 'lucide-react'

export default function FormAnakPacking() {
  const [page, setPage]     = useState(1)
  const [detail, setDetail] = useState(null)

  const { data, isLoading } = useQuery({
    queryKey: ['form-anak-packing', { page }],
    queryFn:  () => formAnakPackingApi.list({ page, limit: 15 }),
  })

  const detailQuery = useQuery({
    queryKey: ['form-anak-packing', detail],
    queryFn:  () => formAnakPackingApi.get(detail),
    enabled:  !!detail,
  })

  const columns = [
    {
      key: 'formNumber', label: 'No. Form', width: 200,
      render: r => <span className="font-mono text-xs font-semibold text-slate-600">{r.formNumber}</span>,
    },
    {
      key: 'worker', label: 'Pekerja',
      render: r => <span className="text-slate-700">{r.worker?.name ?? '—'}</span>,
    },
    {
      key: 'incomingGoods', label: 'Barang Masuk',
      render: r => <span className="font-mono text-xs text-slate-600">{r.PackingJob?.incomingGoods?.docNumber ?? '—'}</span>,
    },
    {
      key: 'generatedAt', label: 'Tanggal',
      render: r => <span className="text-slate-600">{r.generatedAt ? new Date(r.generatedAt).toLocaleDateString('id-ID') : '—'}</span>,
    },
    {
      key: 'generatedByUser', label: 'Dibuat Oleh',
      render: r => <span className="text-slate-500 text-xs">{r.generatedByUser?.name ?? '—'}</span>,
    },
    {
      key: 'actions', label: '', width: 60,
      render: r => (
        <button onClick={() => setDetail(r.id)} className="btn-edit" title="Detail">
          <Eye size={12} />
        </button>
      ),
    },
  ]

  const form = detailQuery.data

  return (
    <div className="px-6 py-6">
      <PageHeader
        title="Form Anak Packing"
        subtitle={`${data?.pagination?.total ?? 0} form`}
      />

      <div className="card overflow-hidden">
        <Table columns={columns} data={data?.data} loading={isLoading} emptyText="Belum ada Form Anak Packing" />
        <Pagination pagination={data?.pagination} onPageChange={setPage} />
      </div>

      <Modal
        open={!!detail}
        onClose={() => setDetail(null)}
        title="Detail Form Anak Packing"
        size="lg"
      >
        {detailQuery.isLoading ? (
          <div className="py-8 text-center text-sm text-slate-500">Memuat…</div>
        ) : form ? (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-slate-400 text-xs">No. Form</p>
                <p className="font-mono font-semibold text-slate-800">{form.formNumber}</p>
              </div>
              <div>
                <p className="text-slate-400 text-xs">Tanggal Dibuat</p>
                <p className="text-slate-800">
                  {form.generatedAt
                    ? new Date(form.generatedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
                    : '—'}
                </p>
              </div>
              <div>
                <p className="text-slate-400 text-xs">Pekerja</p>
                <p className="text-slate-800 font-medium">{form.worker?.name ?? '—'}</p>
              </div>
              <div>
                <p className="text-slate-400 text-xs">Barang Masuk</p>
                <p className="font-mono text-slate-800">{form.PackingJob?.incomingGoods?.docNumber ?? '—'}</p>
              </div>
              <div>
                <p className="text-slate-400 text-xs">Dibuat Oleh</p>
                <p className="text-slate-600">{form.generatedByUser?.name ?? '—'}</p>
              </div>
              {form.notes && (
                <div className="col-span-2">
                  <p className="text-slate-400 text-xs">Catatan</p>
                  <p className="text-slate-700">{form.notes}</p>
                </div>
              )}
            </div>

            {(form.snapshotResults ?? []).length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Hasil Packing</p>
                <div className="rounded-lg border border-slate-200 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">#</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">Produk</th>
                        <th className="px-3 py-2 text-right text-xs font-semibold text-slate-500">Qty Ready</th>
                        <th className="px-3 py-2 text-right text-xs font-semibold text-slate-500">Qty Reject</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">Catatan</th>
                      </tr>
                    </thead>
                    <tbody>
                      {form.snapshotResults.map((r, i) => (
                        <tr key={i} className="border-b border-slate-100 last:border-0">
                          <td className="px-3 py-2 text-slate-400 text-xs">{i + 1}</td>
                          <td className="px-3 py-2 text-slate-800 font-medium">{r.productName}</td>
                          <td className="px-3 py-2 text-right font-mono text-green-700">{r.qtyReady?.toLocaleString('id-ID')}</td>
                          <td className="px-3 py-2 text-right font-mono text-red-600">{r.qtyReject?.toLocaleString('id-ID')}</td>
                          <td className="px-3 py-2 text-slate-500">{r.notes || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Summary row */}
                <div className="mt-2 flex gap-6 px-3 text-sm">
                  <div>
                    <span className="text-slate-400 text-xs">Total Ready: </span>
                    <span className="font-mono font-semibold text-green-700">
                      {form.snapshotResults.reduce((s, r) => s + (r.qtyReady ?? 0), 0).toLocaleString('id-ID')}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-xs">Total Reject: </span>
                    <span className="font-mono font-semibold text-red-600">
                      {form.snapshotResults.reduce((s, r) => s + (r.qtyReject ?? 0), 0).toLocaleString('id-ID')}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : null}
      </Modal>
    </div>
  )
}
