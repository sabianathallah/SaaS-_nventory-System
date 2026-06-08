import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { deliveryNotesApi, vendorsApi } from '../api'
import { useAuth } from '../context/AuthContext'
import PageHeader from '../components/PageHeader'
import { Table, Pagination } from '../components/Table'
import SearchableSelect from '../components/SearchableSelect'
import Modal from '../components/Modal'
import toast from 'react-hot-toast'
import { Plus, Eye, Trash2, ImageIcon, Link2, Pencil } from 'lucide-react'

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

function SJForm({ sj, onClose }) {
  const qc = useQueryClient()
  const [vendorId, setVendorId] = useState(sj?.Vendor?.id ?? '')
  const [date,     setDate]     = useState(sj?.date ?? new Date().toISOString().slice(0, 10))
  const [notes,    setNotes]    = useState(sj?.notes ?? '')
  const [file,     setFile]     = useState(null)
  const [preview,  setPreview]  = useState(sj?.photoUrl ?? null)

  const { data: vendors } = useQuery({ queryKey: ['vendors', { limit: 200 }], queryFn: () => vendorsApi.list({ limit: 200 }) })

  const save = useMutation({
    mutationFn: (fd) => sj ? deliveryNotesApi.update(sj.id, fd) : deliveryNotesApi.create(fd),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['delivery-notes'] })
      toast.success(sj ? 'Surat Jalan diperbarui' : 'Surat Jalan disimpan')
      onClose()
    },
    onError: e => toast.error(e.response?.data?.message || 'Error'),
  })

  function handleFile(e) {
    const f = e.target.files[0]
    if (!f) return
    setFile(f)
    setPreview(URL.createObjectURL(f))
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (!date) return toast.error('Tanggal wajib diisi')
    const fd = new FormData()
    fd.append('date', date)
    if (vendorId) fd.append('vendorId', vendorId)
    if (notes.trim()) fd.append('notes', notes.trim())
    if (file) fd.append('photo', file)
    save.mutate(fd)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="label">Vendor (opsional)</label>
        <SearchableSelect
          value={String(vendorId)}
          onChange={v => setVendorId(v)}
          options={[{ value: '', label: 'Pilih vendor…' }, ...(vendors?.data ?? []).map(v => ({ value: String(v.id), label: v.name }))]}
          placeholder="Pilih vendor…"
        />
      </div>
      <div>
        <label className="label">Tanggal <span className="text-danger">*</span></label>
        <input type="date" className="input" value={date} onChange={e => setDate(e.target.value)} required />
      </div>
      <div>
        <label className="label">Foto Surat Jalan</label>
        {preview ? (
          <div className="relative w-full h-44 rounded-xl overflow-hidden border border-slate-200 mb-2 bg-slate-50">
            <img src={preview} alt="preview" className="w-full h-full object-contain" />
            <button type="button" onClick={() => { setFile(null); setPreview(null) }}
              className="absolute top-2 right-2 w-6 h-6 rounded-full bg-white/80 flex items-center justify-center text-slate-500 hover:text-red-500 shadow">
              ×
            </button>
          </div>
        ) : (
          <label className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-slate-200 rounded-xl cursor-pointer hover:border-brand/40 transition-colors bg-slate-50">
            <ImageIcon size={22} className="text-slate-300 mb-1" />
            <span className="text-xs text-slate-400">Klik untuk upload foto</span>
            <input type="file" accept="image/*" className="hidden" onChange={handleFile} />
          </label>
        )}
      </div>
      <div>
        <label className="label">Catatan (opsional)</label>
        <textarea className="input resize-none" rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Catatan…" />
      </div>
      <div className="flex gap-2 pt-1">
        <button type="button" onClick={onClose} className="btn-secondary flex-1 justify-center">Batal</button>
        <button type="submit" disabled={save.isPending} className="btn-primary flex-1 justify-center">
          {save.isPending ? 'Menyimpan…' : sj ? 'Simpan' : 'Buat'}
        </button>
      </div>
    </form>
  )
}

export default function SuratJalan() {
  const { hasPermission } = useAuth()
  const canManage = hasPermission('packing.manage') || hasPermission('packing.incoming')
  const navigate  = useNavigate()

  const [searchParams, setSearchParams] = useSearchParams()
  const page    = Number(searchParams.get('page')  || '1')
  const limit   = Number(searchParams.get('limit') || '15')
  const setPage = (p) => setSearchParams(prev => { prev.set('page', String(p)); return prev }, { replace: true })

  const [modal,   setModal]   = useState(null)
  const [preview, setPreview] = useState(null)

  const qc = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ['delivery-notes', { page, limit }],
    queryFn:  () => deliveryNotesApi.list({ page, limit }),
  })

  const del = useMutation({
    mutationFn: (id) => deliveryNotesApi.remove(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['delivery-notes'] }); toast.success('Surat Jalan dihapus') },
    onError: e => toast.error(e.response?.data?.message || 'Gagal menghapus'),
  })

  const columns = [
    { key: 'id',     label: '#',      width: 60,  render: r => <span className="font-mono text-xs text-slate-400">#{r.id}</span> },
    { key: 'date',   label: 'Tanggal', width: 130, render: r => <span className="text-xs font-mono text-slate-500">{fmtDate(r.date)}</span> },
    { key: 'vendor', label: 'Vendor',              render: r => <span className="font-semibold text-slate-800">{r.Vendor?.name ?? <span className="text-slate-300 text-xs">—</span>}</span> },
    {
      key: 'foto', label: 'Foto', width: 80,
      render: r => r.photoUrl
        ? <button onClick={() => setPreview(r.photoUrl)} className="w-10 h-10 rounded-lg overflow-hidden border border-slate-200 hover:border-brand transition-colors">
            <img src={r.photoUrl} alt="sj" className="w-full h-full object-cover" />
          </button>
        : <span className="text-xs text-slate-300">—</span>,
    },
    {
      key: 'linked', label: 'Barang Masuk', width: 130,
      render: r => r.delivery
        ? <button onClick={() => navigate(`/incoming-goods/${r.delivery.id}`)} className="text-xs text-brand hover:underline flex items-center gap-1">
            <Link2 size={11} /> Lihat
          </button>
        : <span className="text-xs text-slate-300">Belum terhubung</span>,
    },
    { key: 'notes',  label: 'Catatan', render: r => <span className="text-xs text-slate-400 truncate max-w-[180px] block">{r.notes || '—'}</span> },
    { key: 'by',     label: 'Dibuat oleh', width: 130, render: r => <span className="text-xs text-slate-500">{r.Creator?.name ?? '—'}</span> },
    {
      key: 'actions', label: '', width: 80,
      render: r => canManage ? (
        <div className="flex gap-1 justify-end">
          <button onClick={() => setModal({ mode: 'edit', sj: r })} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg">
            <Pencil size={13} />
          </button>
          <button onClick={() => { if (confirm('Hapus Surat Jalan ini?')) del.mutate(r.id) }}
            className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg">
            <Trash2 size={13} />
          </button>
        </div>
      ) : null,
    },
  ]

  return (
    <div className="px-6 py-6">
      <PageHeader
        title="Surat Jalan"
        subtitle={`${data?.pagination?.total ?? 0} dokumen`}
        action={canManage && (
          <button onClick={() => setModal({ mode: 'create' })} className="btn-primary">
            <Plus size={14} /> Upload SJ
          </button>
        )}
      />

      <div className="card overflow-hidden">
        <Table columns={columns} data={data?.data} loading={isLoading} emptyText="Belum ada Surat Jalan" />
        <Pagination pagination={data?.pagination} onPageChange={setPage} />
      </div>

      <Modal open={modal?.mode === 'create'} onClose={() => setModal(null)} title="Upload Surat Jalan">
        <SJForm onClose={() => setModal(null)} />
      </Modal>
      <Modal open={modal?.mode === 'edit'} onClose={() => setModal(null)} title="Edit Surat Jalan">
        {modal?.sj && <SJForm sj={modal.sj} onClose={() => setModal(null)} />}
      </Modal>

      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70" onClick={() => setPreview(null)}>
          <img src={preview} alt="preview" className="max-w-full max-h-full rounded-xl shadow-2xl" onClick={e => e.stopPropagation()} />
        </div>
      )}
    </div>
  )
}
