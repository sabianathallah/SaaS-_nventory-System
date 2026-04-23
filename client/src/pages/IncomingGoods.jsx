import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { incomingGoodsApi, vendorsApi, productsApi } from '../api'
import { useAuth } from '../context/AuthContext'
import PageHeader from '../components/PageHeader'
import { Table, Pagination } from '../components/Table'
import Modal from '../components/Modal'
import toast from 'react-hot-toast'
import QRScanner from '../components/QRScanner'
import {
  Plus, Eye, CheckCircle, BellRing, PackageCheck,
  Trash2, ChevronDown, X, ScanLine,
} from 'lucide-react'

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_LABEL = {
  DRAFT:                'Draft',
  VENDOR_CONFIRMED:     'Vendor Confirmed',
  PRODUCTION_NOTIFIED:  'Produksi Notified',
  PACKING_IN_PROGRESS:  'Packing In Progress',
  COMPLETED:            'Completed',
}
const STATUS_BADGE = {
  DRAFT:                'badge-muted',
  VENDOR_CONFIRMED:     'badge-teal',
  PRODUCTION_NOTIFIED:  'badge-amber',
  PACKING_IN_PROGRESS:  'badge-brand',
  COMPLETED:            'badge-green',
}

const fmt = (d) => d ? new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

const EMPTY_FORM = { VendorId: '', receivedDate: '', vendorDeliveryNote: '', notes: '' }
const EMPTY_ITEM = { ProductId: '', qtyOrdered: '', qtyReceived: '', unit: 'pcs', notes: '' }

// ── Component ─────────────────────────────────────────────────────────────────

export default function IncomingGoods() {
  const qc = useQueryClient()
  const { isOperasional } = useAuth()
  const [page, setPage]       = useState(1)
  const [statusFilter, setStatusFilter] = useState('')
  const [modal, setModal]       = useState(null)
  const [form, setForm]         = useState(EMPTY_FORM)
  const [items, setItems]       = useState([])
  const [newItem, setNewItem]   = useState(EMPTY_ITEM)
  const [actionNote, setActionNote] = useState('')
  const [showScanner, setShowScanner] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['incoming-goods', { page, status: statusFilter }],
    queryFn:  () => incomingGoodsApi.list({ page, limit: 15, status: statusFilter || undefined }),
  })

  const { data: vendors }  = useQuery({ queryKey: ['vendors-all'],  queryFn: () => vendorsApi.list({ limit: 200 }) })
  const { data: products } = useQuery({ queryKey: ['products-all'], queryFn: () => productsApi.list({ limit: 500 }) })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['incoming-goods'] })

  const createMut = useMutation({
    mutationFn: incomingGoodsApi.create,
    onSuccess: () => { invalidate(); toast.success('Dokumen berhasil dibuat'); closeModal() },
    onError:   e => toast.error(e.response?.data?.message || 'Error'),
  })
  const confirmMut = useMutation({
    mutationFn: ({ id, notes }) => incomingGoodsApi.confirmVendor(id, { notes }),
    onSuccess: () => { invalidate(); toast.success('Vendor dikonfirmasi — Surat Jalan digenerate'); closeModal() },
    onError:   e => toast.error(e.response?.data?.message || 'Error'),
  })
  const notifyMut = useMutation({
    mutationFn: (id) => incomingGoodsApi.notifyProduction(id, {}),
    onSuccess: () => { invalidate(); toast.success('Notifikasi ke Produksi berhasil dikirim'); closeModal() },
    onError:   e => toast.error(e.response?.data?.message || 'Error'),
  })
  const completeMut = useMutation({
    mutationFn: incomingGoodsApi.complete,
    onSuccess: (res) => {
      invalidate()
      const s = res.summary
      toast.success(`Selesai — Ready: ${s.totalReady}, Reject: ${s.totalReject}`)
      closeModal()
    },
    onError: e => toast.error(e.response?.data?.message || 'Error'),
  })
  const deleteMut = useMutation({
    mutationFn: incomingGoodsApi.remove,
    onSuccess: () => { invalidate(); toast.success('Dokumen dihapus') },
    onError:   e => toast.error(e.response?.data?.message || 'Error'),
  })

  const closeModal = () => { setModal(null); setForm(EMPTY_FORM); setItems([]); setNewItem(EMPTY_ITEM); setActionNote('') }

  const handleProductScan = (code) => {
    const prod = products?.data?.find(p => p.sku === code || String(p.id) === code)
    if (!prod) return toast.error(`Produk dengan kode "${code}" tidak ditemukan`)
    setNewItem(prev => ({ ...prev, ProductId: String(prod.id) }))
    toast.success(`Produk dipilih: ${prod.name}`)
  }

  const setF = (f) => (e) => setForm(prev => ({ ...prev, [f]: e.target.value }))
  const setNI = (f) => (e) => setNewItem(prev => ({ ...prev, [f]: e.target.value }))

  const addItem = () => {
    if (!newItem.ProductId || !newItem.qtyOrdered) return toast.error('Pilih produk dan isi qty ordered')
    const prod = products?.data?.find(p => String(p.id) === String(newItem.ProductId))
    setItems(prev => [...prev, {
      ...newItem,
      qtyOrdered:  Number(newItem.qtyOrdered),
      qtyReceived: Number(newItem.qtyReceived) || 0,
      productName: prod?.name,
    }])
    setNewItem(EMPTY_ITEM)
  }

  const handleCreate = (e) => {
    e.preventDefault()
    if (!items.length) return toast.error('Tambahkan minimal 1 item')
    createMut.mutate({ ...form, items: items.map(i => ({
      ProductId:   Number(i.ProductId),
      qtyOrdered:  i.qtyOrdered,
      qtyReceived: i.qtyReceived,
      unit:        i.unit,
      notes:       i.notes || undefined,
    }))})
  }

  const openDetail = async (row) => {
    const detail = await incomingGoodsApi.get(row.id)
    setModal({ mode: 'view', data: detail })
  }

  const columns = [
    {
      key: 'docNumber', label: 'No. Dokumen', width: 160,
      render: r => <span className="font-mono text-xs font-semibold text-slate-700">{r.docNumber}</span>,
    },
    {
      key: 'vendor', label: 'Vendor',
      render: r => <span className="font-semibold text-slate-800">{r.Vendor?.name ?? '—'}</span>,
    },
    {
      key: 'receivedDate', label: 'Tgl Terima', width: 120,
      render: r => <span className="text-xs text-slate-500">{fmt(r.receivedDate)}</span>,
    },
    {
      key: 'totalQty', label: 'Total Qty', width: 90,
      render: r => <span className="font-mono font-semibold text-slate-700">{r.totalQty}</span>,
    },
    {
      key: 'status', label: 'Status', width: 170,
      render: r => <span className={STATUS_BADGE[r.status]}>{STATUS_LABEL[r.status]}</span>,
    },
    {
      key: 'actions', label: '', width: 130,
      render: r => (
        <div className="flex items-center gap-1">
          <button onClick={() => openDetail(r)} className="btn-edit" title="Lihat detail"><Eye size={13} /></button>
          {isOperasional && r.status === 'DRAFT' && (
            <button onClick={() => { setModal({ mode: 'confirm', data: r }); setActionNote('') }} className="p-1.5 rounded text-teal-500 hover:bg-teal-50 transition-colors" title="Konfirmasi Vendor">
              <CheckCircle size={13} />
            </button>
          )}
          {isOperasional && r.status === 'VENDOR_CONFIRMED' && (
            <button onClick={() => notifyMut.mutate(r.id)} className="p-1.5 rounded text-amber-500 hover:bg-amber-50 transition-colors" title="Notifikasi Produksi">
              <BellRing size={13} />
            </button>
          )}
          {isOperasional && r.status === 'PACKING_IN_PROGRESS' && (
            <button onClick={() => setModal({ mode: 'complete', data: r })} className="p-1.5 rounded text-green-600 hover:bg-green-50 transition-colors" title="Rekap & Selesaikan">
              <PackageCheck size={13} />
            </button>
          )}
          {isOperasional && r.status === 'DRAFT' && (
            <button onClick={() => { if (confirm('Hapus dokumen ini?')) deleteMut.mutate(r.id) }} className="p-1.5 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors">
              <Trash2 size={13} />
            </button>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="px-6 py-6">
      <PageHeader
        title="Barang Masuk"
        subtitle={`${data?.pagination?.total ?? 0} dokumen`}
        action={
          <div className="flex items-center gap-2">
            <select className="select w-48" value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1) }}>
              <option value="">Semua Status</option>
              {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            {isOperasional && (
              <button onClick={() => { setForm(EMPTY_FORM); setItems([]); setModal('create') }} className="btn-primary">
                <Plus size={14} /> Baru
              </button>
            )}
          </div>
        }
      />

      <div className="card overflow-hidden">
        <Table columns={columns} data={data?.data} loading={isLoading} emptyText="Belum ada data barang masuk" />
        <Pagination pagination={data?.pagination} onPageChange={setPage} />
      </div>

      {/* ── Create Modal ──────────────────────────────────────────────────────── */}
      <Modal open={modal === 'create'} onClose={closeModal} title="Input Barang Masuk" size="xl">
        <form onSubmit={handleCreate} className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Vendor <span className="text-danger">*</span></label>
              <select className="select" value={form.VendorId} onChange={setF('VendorId')} required>
                <option value="">Pilih vendor…</option>
                {vendors?.data?.map(v => <option key={v.id} value={v.id}>{v.name} ({v.vendorCode})</option>)}
              </select>
            </div>
            <div>
              <label className="label">Tanggal Terima <span className="text-danger">*</span></label>
              <input className="input" type="date" value={form.receivedDate} onChange={setF('receivedDate')} required />
            </div>
            <div>
              <label className="label">No. Surat Jalan Vendor</label>
              <input className="input" value={form.vendorDeliveryNote} onChange={setF('vendorDeliveryNote')} placeholder="SJ-EXT-0001" />
            </div>
            <div>
              <label className="label">Catatan</label>
              <input className="input" value={form.notes} onChange={setF('notes')} placeholder="Opsional…" />
            </div>
          </div>

          {/* Items */}
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
              <Plus size={13} className="text-red-700" />
              <span className="text-xs font-bold text-slate-600 uppercase tracking-wide">Item Barang</span>
            </div>
            <div className="p-3 bg-white flex flex-wrap gap-2 border-b border-slate-100">
              <div className="flex gap-1.5 flex-1 min-w-[180px]">
                <select className="select flex-1" value={newItem.ProductId} onChange={setNI('ProductId')}>
                  <option value="">Pilih produk…</option>
                  {products?.data?.map(p => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
                </select>
                <button
                  type="button"
                  onClick={() => setShowScanner(true)}
                  className="px-2.5 rounded-lg border border-slate-200 text-slate-400 hover:text-brand hover:border-brand/40 hover:bg-brand/5 transition-colors flex-shrink-0"
                  title="Scan barcode produk"
                >
                  <ScanLine size={15} />
                </button>
              </div>
              <input className="input w-24" type="number" min="1" placeholder="Qty Order" value={newItem.qtyOrdered} onChange={setNI('qtyOrdered')} />
              <input className="input w-24" type="number" min="0" placeholder="Qty Terima" value={newItem.qtyReceived} onChange={setNI('qtyReceived')} />
              <input className="input w-20" placeholder="Satuan" value={newItem.unit} onChange={setNI('unit')} />
              <button type="button" onClick={addItem} className="btn-primary px-3"><Plus size={14} /></button>
            </div>
            {!items.length ? (
              <p className="text-center text-slate-400 text-sm py-5 bg-white">Belum ada item</p>
            ) : (
              <table className="w-full bg-white text-sm">
                <thead><tr className="bg-slate-50 border-b border-slate-100 text-xs text-slate-500 font-semibold uppercase">
                  <th className="px-4 py-2 text-left">Produk</th>
                  <th className="px-4 py-2 text-right">Qty Order</th>
                  <th className="px-4 py-2 text-right">Qty Terima</th>
                  <th className="px-4 py-2 text-left">Satuan</th>
                  <th className="px-4 py-2 w-8"></th>
                </tr></thead>
                <tbody>
                  {items.map((it, idx) => (
                    <tr key={idx} className="border-b border-slate-50">
                      <td className="px-4 py-2">{it.productName}</td>
                      <td className="px-4 py-2 text-right font-mono font-semibold">{it.qtyOrdered}</td>
                      <td className="px-4 py-2 text-right font-mono text-success font-semibold">{it.qtyReceived}</td>
                      <td className="px-4 py-2 text-slate-400">{it.unit}</td>
                      <td className="px-4 py-2">
                        <button type="button" onClick={() => setItems(p => p.filter((_, i) => i !== idx))} className="text-slate-300 hover:text-red-500 transition-colors"><X size={12} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={closeModal} className="btn-secondary flex-1 justify-center">Batal</button>
            <button type="submit" disabled={createMut.isPending} className="btn-primary flex-1 justify-center">
              {createMut.isPending ? 'Menyimpan…' : 'Simpan Dokumen'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Detail / View Modal ───────────────────────────────────────────────── */}
      <Modal open={modal?.mode === 'view'} onClose={closeModal} title={`Detail — ${modal?.data?.docNumber}`} size="xl">
        {modal?.data && <DetailView data={modal.data} onClose={closeModal} />}
      </Modal>

      {/* ── Confirm Vendor Modal ──────────────────────────────────────────────── */}
      <Modal open={modal?.mode === 'confirm'} onClose={closeModal} title="Konfirmasi ke Vendor" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Konfirmasi kuantitas <strong>{modal?.data?.docNumber}</strong> ke vendor dan generate Surat Jalan?
          </p>
          <div>
            <label className="label">Catatan (opsional)</label>
            <textarea className="input" rows={2} value={actionNote} onChange={e => setActionNote(e.target.value)} placeholder="Kuantitas sesuai…" />
          </div>
          <div className="flex gap-2">
            <button onClick={closeModal} className="btn-secondary flex-1 justify-center">Batal</button>
            <button
              onClick={() => confirmMut.mutate({ id: modal.data.id, notes: actionNote })}
              disabled={confirmMut.isPending}
              className="btn-primary flex-1 justify-center"
            >
              <CheckCircle size={14} /> {confirmMut.isPending ? 'Memproses…' : 'Konfirmasi + Generate SJ'}
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Complete Modal ────────────────────────────────────────────────────── */}
      <Modal open={modal?.mode === 'complete'} onClose={closeModal} title="Rekap Akhir" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Selesaikan dokumen <strong>{modal?.data?.docNumber}</strong>?
            Semua packing job harus sudah diverifikasi.
          </p>
          <div className="flex gap-2">
            <button onClick={closeModal} className="btn-secondary flex-1 justify-center">Batal</button>
            <button
              onClick={() => completeMut.mutate(modal.data.id)}
              disabled={completeMut.isPending}
              className="btn-primary flex-1 justify-center"
            >
              <PackageCheck size={14} /> {completeMut.isPending ? 'Memproses…' : 'Selesaikan'}
            </button>
          </div>
        </div>
      </Modal>

      {/* ── QR Scanner overlay ────────────────────────────────────────────────── */}
      {showScanner && (
        <QRScanner
          onScan={handleProductScan}
          onClose={() => setShowScanner(false)}
          hint="Scan barcode / QR produk untuk memilih otomatis"
        />
      )}
    </div>
  )
}

// ── Detail sub-component ──────────────────────────────────────────────────────

function DetailView({ data, onClose }) {
  const statusColor = STATUS_BADGE[data.status]
  return (
    <div className="space-y-5 text-sm">
      {/* Header info */}
      <div className="grid grid-cols-3 gap-4">
        <div><label className="label">No. Dokumen</label><p className="font-mono font-semibold text-slate-800">{data.docNumber}</p></div>
        <div><label className="label">Status</label><span className={statusColor}>{STATUS_LABEL[data.status]}</span></div>
        <div><label className="label">Tanggal Terima</label><p className="text-slate-600">{fmt(data.receivedDate)}</p></div>
        <div><label className="label">Vendor</label><p className="font-semibold text-slate-800">{data.Vendor?.name}</p></div>
        <div><label className="label">Diterima Oleh</label><p className="text-slate-600">{data.receivedByUser?.name}</p></div>
        <div><label className="label">No. SJ Vendor</label><p className="text-slate-500">{data.vendorDeliveryNote || '—'}</p></div>
        {data.notes && <div className="col-span-3"><label className="label">Catatan</label><p className="text-slate-500">{data.notes}</p></div>}
      </div>

      {/* Items */}
      <div>
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Items</p>
        <div className="border border-slate-200 rounded-lg overflow-hidden">
          <table className="w-full text-xs">
            <thead><tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase">
              <th className="px-3 py-2 text-left">Produk</th>
              <th className="px-3 py-2 text-right">SKU</th>
              <th className="px-3 py-2 text-right">Qty Order</th>
              <th className="px-3 py-2 text-right">Qty Terima</th>
              <th className="px-3 py-2 text-right">Ready</th>
              <th className="px-3 py-2 text-right">Reject</th>
            </tr></thead>
            <tbody>
              {data.items?.map(item => (
                <tr key={item.id} className="border-b border-slate-50 last:border-0">
                  <td className="px-3 py-2 font-medium text-slate-700">{item.Product?.name}</td>
                  <td className="px-3 py-2 text-right font-mono text-slate-400">{item.Product?.sku}</td>
                  <td className="px-3 py-2 text-right font-mono">{item.qtyOrdered}</td>
                  <td className="px-3 py-2 text-right font-mono font-semibold">{item.qtyReceived}</td>
                  <td className="px-3 py-2 text-right font-mono font-semibold text-green-600">{item.qtyReady ?? '—'}</td>
                  <td className="px-3 py-2 text-right font-mono font-semibold text-red-500">{item.qtyReject ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Surat Jalan */}
      {data.suratJalan && (
        <div className="flex items-center gap-3 p-3 bg-teal-50 border border-teal-200 rounded-lg">
          <CheckCircle size={16} className="text-teal-600 flex-shrink-0" />
          <div>
            <p className="font-semibold text-teal-800 text-xs">Surat Jalan Digenerate</p>
            <p className="text-teal-600 font-mono text-xs">{data.suratJalan.sjNumber}</p>
          </div>
          <span className="ml-auto text-teal-500 text-xs">{data.suratJalan.printedAt ? '✓ Printed' : 'Belum print'}</span>
        </div>
      )}

      {/* Packing Jobs */}
      {data.packingJobs?.length > 0 && (
        <div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Packing Jobs</p>
          <div className="space-y-1.5">
            {data.packingJobs.map(job => (
              <div key={job.id} className="flex items-center justify-between px-3 py-2 bg-slate-50 rounded-lg border border-slate-200 text-xs">
                <span className="font-medium text-slate-700">Job #{job.id} — {job.assignedToUser?.name}</span>
                <span className={`badge-muted ${
                  job.status === 'VERIFIED'   ? 'badge-green' :
                  job.status === 'SUBMITTED'  ? 'badge-teal'  :
                  job.status === 'IN_PROGRESS'? 'badge-amber' : 'badge-muted'
                }`}>{job.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <button onClick={onClose} className="btn-secondary w-full justify-center mt-1">Tutup</button>
    </div>
  )
}
