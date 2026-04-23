import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { suratJalanApi } from '../api'
import PageHeader from '../components/PageHeader'
import { Table, Pagination } from '../components/Table'
import Modal from '../components/Modal'
import toast from 'react-hot-toast'
import { Eye, Printer } from 'lucide-react'

// Model has `printedAt` (DATE | null) — derive status from it
const isPrinted = (row) => !!row.printedAt

const BADGE_PRINTED   = 'bg-green-100 text-green-700'
const BADGE_UNPRINTED = 'bg-amber-100 text-amber-700'

const fmt = (d) =>
  d ? new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'

export default function SuratJalan() {
  const qc = useQueryClient()
  const [page, setPage]     = useState(1)
  const [detail, setDetail] = useState(null)

  const { data, isLoading } = useQuery({
    queryKey: ['surat-jalan', { page }],
    queryFn:  () => suratJalanApi.list({ page, limit: 15 }),
  })

  const detailQuery = useQuery({
    queryKey: ['surat-jalan', detail],
    queryFn:  () => suratJalanApi.get(detail),
    enabled:  !!detail,
  })

  const printMut = useMutation({
    mutationFn: suratJalanApi.markPrinted,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['surat-jalan'] })
      toast.success('Surat Jalan ditandai sudah dicetak')
    },
    onError: e => toast.error(e.response?.data?.message || 'Error'),
  })

  const handlePrint = (row) => {
    window.print()
    if (!isPrinted(row)) printMut.mutate(row.id)
  }

  const columns = [
    {
      key: 'sjNumber', label: 'No. SJ', width: 200,
      render: r => <span className="font-mono text-xs font-semibold text-slate-600">{r.sjNumber}</span>,
    },
    {
      key: 'IncomingGoods', label: 'No. Barang Masuk',
      render: r => <span className="font-mono text-xs text-slate-600">{r.IncomingGoods?.docNumber ?? '—'}</span>,
    },
    {
      key: 'generatedAt', label: 'Tanggal',
      render: r => <span className="text-slate-600 text-xs">{fmt(r.generatedAt)}</span>,
    },
    {
      key: 'printedAt', label: 'Status', width: 130,
      render: r => (
        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${isPrinted(r) ? BADGE_PRINTED : BADGE_UNPRINTED}`}>
          {isPrinted(r) ? 'Sudah Dicetak' : 'Belum Dicetak'}
        </span>
      ),
    },
    {
      key: 'actions', label: '', width: 80,
      render: r => (
        <div className="flex items-center gap-1">
          <button onClick={() => setDetail(r.id)} className="btn-edit" title="Detail"><Eye size={12} /></button>
          <button
            onClick={() => handlePrint(r)}
            className="p-1.5 rounded text-slate-400 hover:text-brand hover:bg-red-50 transition-colors"
            title="Cetak"
            disabled={printMut.isPending}
          >
            <Printer size={12} />
          </button>
        </div>
      ),
    },
  ]

  const sj = detailQuery.data

  return (
    <div className="px-6 py-6">
      <PageHeader
        title="Surat Jalan"
        subtitle={`${data?.pagination?.total ?? 0} surat jalan`}
      />

      <div className="card overflow-hidden">
        <Table columns={columns} data={data?.data} loading={isLoading} emptyText="Belum ada surat jalan" />
        <Pagination pagination={data?.pagination} onPageChange={setPage} />
      </div>

      <Modal
        open={!!detail}
        onClose={() => setDetail(null)}
        title="Detail Surat Jalan"
        size="lg"
      >
        {detailQuery.isLoading ? (
          <div className="py-8 text-center text-sm text-slate-500">Memuat…</div>
        ) : sj ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-slate-400 text-xs">No. Surat Jalan</p>
                <p className="font-mono font-semibold text-slate-800">{sj.sjNumber}</p>
              </div>
              <div>
                <p className="text-slate-400 text-xs">No. Barang Masuk</p>
                <p className="font-mono font-semibold text-slate-800">{sj.IncomingGoods?.docNumber ?? '—'}</p>
              </div>
              <div>
                <p className="text-slate-400 text-xs">Vendor</p>
                <p className="font-semibold text-slate-800">{sj.IncomingGoods?.Vendor?.name ?? '—'}</p>
              </div>
              <div>
                <p className="text-slate-400 text-xs">Tanggal Terbit</p>
                <p className="text-slate-800">{fmt(sj.generatedAt)}</p>
              </div>
              <div>
                <p className="text-slate-400 text-xs">Status</p>
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${isPrinted(sj) ? BADGE_PRINTED : BADGE_UNPRINTED}`}>
                  {isPrinted(sj) ? 'Sudah Dicetak' : 'Belum Dicetak'}
                </span>
              </div>
              {sj.printedAt && (
                <div>
                  <p className="text-slate-400 text-xs">Dicetak Pada</p>
                  <p className="text-slate-600 text-xs">{fmt(sj.printedAt)}</p>
                </div>
              )}
              {sj.notes && (
                <div className="col-span-2">
                  <p className="text-slate-400 text-xs">Catatan</p>
                  <p className="text-slate-700">{sj.notes}</p>
                </div>
              )}
            </div>

            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Item Barang</p>
              <div className="rounded-lg border border-slate-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">#</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">Produk</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">SKU</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-slate-500">Qty Diterima</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">Satuan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(sj.snapshotItems ?? []).map((item, i) => (
                      <tr key={i} className="border-b border-slate-100 last:border-0">
                        <td className="px-3 py-2 text-slate-400 text-xs">{i + 1}</td>
                        <td className="px-3 py-2 text-slate-800 font-medium">{item.productName}</td>
                        <td className="px-3 py-2 font-mono text-slate-400 text-xs">{item.sku || '—'}</td>
                        <td className="px-3 py-2 text-right text-slate-700 font-mono font-semibold">{item.qtyReceived?.toLocaleString('id-ID')}</td>
                        <td className="px-3 py-2 text-slate-500">{item.unit}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <button
                onClick={() => handlePrint(sj)}
                className="btn-primary"
                disabled={printMut.isPending}
              >
                <Printer size={14} /> {isPrinted(sj) ? 'Cetak Ulang' : 'Cetak Surat Jalan'}
              </button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  )
}
