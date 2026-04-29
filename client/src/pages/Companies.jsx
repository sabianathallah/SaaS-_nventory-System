import { useEffect, useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { companiesApi } from '../api'
import PageHeader from '../components/PageHeader'
import { Table, Pagination } from '../components/Table'
import Modal from '../components/Modal'
import SearchBar from '../components/SearchBar'
import toast from 'react-hot-toast'
import { Plus, Pencil, Trash2, Building2, Upload, ImageIcon } from 'lucide-react'

const MAX_LOGO_SIZE = 5 * 1024 * 1024
const EMPTY = { name: '', slug: '', logo: null, logoPreview: '', status: 'active', subscriptionExpiresAt: '' }

const STATUS_BADGE = {
  active:    <span className="badge-green">Active</span>,
  inactive:  <span className="badge-muted">Inactive</span>,
  suspended: <span className="badge-red">Suspended</span>,
}

export default function Companies() {
  const qc = useQueryClient()
  const logoInputRef = useRef(null)
  const [page, setPage]     = useState(1)
  const [search, setSearch] = useState('')
  const [modal, setModal]   = useState(null)
  const [form, setForm]     = useState(EMPTY)

  useEffect(() => {
    return () => {
      if (form.logoPreview?.startsWith('blob:')) URL.revokeObjectURL(form.logoPreview)
    }
  }, [form.logoPreview])

  const { data, isLoading } = useQuery({
    queryKey: ['companies', { page, name: search }],
    queryFn:  () => companiesApi.list({ page, limit: 10, name: search }),
  })

  const save = useMutation({
    mutationFn: d => modal.data ? companiesApi.update(modal.data.id, d) : companiesApi.create(d),
    onSuccess: () => { qc.invalidateQueries(['companies']); toast.success(modal.data ? 'Company updated' : 'Company created'); setModal(null) },
    onError: e => toast.error(e.response?.data?.message || 'Error'),
  })
  const del = useMutation({
    mutationFn: id => companiesApi.remove(id),
    onSuccess: () => { qc.invalidateQueries(['companies']); toast.success('Company deleted'); setModal(null) },
    onError: e => toast.error(e.response?.data?.message || 'Error'),
  })

  const openEdit = (r) => {
    setForm({ name: r.name, slug: r.slug, logo: null, logoPreview: r.logo ?? '', status: r.status,
      subscriptionExpiresAt: r.subscriptionExpiresAt ? r.subscriptionExpiresAt.slice(0, 10) : '' })
    setModal({ mode: 'edit', data: r })
  }

  const handleLogoPick = (file) => {
    if (!file) return
    if (!file.type.startsWith('image/')) return toast.error('File harus berupa gambar')
    if (file.size > MAX_LOGO_SIZE) return toast.error('Ukuran file maks 5MB')
    setForm(prev => {
      if (prev.logoPreview?.startsWith('blob:')) URL.revokeObjectURL(prev.logoPreview)
      return { ...prev, logo: file, logoPreview: URL.createObjectURL(file) }
    })
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const payload = { ...form }
    if (payload.logo instanceof File) {
      // keep the selected file so the API can convert it into multipart/form-data
    } else {
      delete payload.logo
    }
    delete payload.logoPreview
    if (!payload.subscriptionExpiresAt) delete payload.subscriptionExpiresAt
    save.mutate(payload)
  }

  const columns = [
    { key: 'name',    label: 'Perusahaan', render: r => (
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center flex-shrink-0">
          <Building2 size={14} className="text-slate-400" />
        </div>
        <div>
          <p className="font-semibold text-slate-800">{r.name}</p>
          <p className="text-xs font-mono text-slate-400">{r.slug}</p>
        </div>
      </div>
    )},
    { key: 'status',  label: 'Status',  width: 110, render: r => STATUS_BADGE[r.status] ?? <span className="badge-muted">{r.status}</span> },
    { key: 'expires', label: 'Berlaku Sampai',             render: r => r.subscriptionExpiresAt
      ? <span className="text-xs text-slate-500">{new Date(r.subscriptionExpiresAt).toLocaleDateString('id-ID')}</span>
      : <span className="text-slate-300 text-xs">—</span>
    },
    { key: 'created', label: 'Dibuat',             render: r => <span className="text-xs text-slate-400">{new Date(r.createdAt).toLocaleDateString('id-ID')}</span> },
    { key: 'actions', label: '', width: 80, render: r => (
      <div className="flex gap-1">
        <button onClick={() => openEdit(r)} className="p-1.5 rounded text-slate-400 btn-edit transition-colors"><Pencil size={13} /></button>
        <button onClick={() => setModal({ mode: 'delete', data: r })} className="p-1.5 rounded text-slate-400 hover:text-danger hover:bg-danger-light transition-colors"><Trash2 size={13} /></button>
      </div>
    )},
  ]

  return (
    <div className="px-6 py-6">
      <PageHeader title="Perusahaan" subtitle={`${data?.pagination?.total ?? 0} perusahaan`}
        action={<button onClick={() => { setForm(EMPTY); setModal({ mode: 'create' }) }} className="btn-primary"><Plus size={14} />Perusahaan Baru</button>}
      />

      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
          <SearchBar value={search} onChange={v => { setSearch(v); setPage(1) }} placeholder="Cari perusahaan…" />
        </div>
        <Table columns={columns} data={data?.data} loading={isLoading} />
        <Pagination pagination={data?.pagination} onPageChange={setPage} />
      </div>

      <Modal open={['create','edit'].includes(modal?.mode)} onClose={() => setModal(null)}
        title={modal?.mode === 'edit' ? 'Ubah Perusahaan' : 'Perusahaan Baru'} size="md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="label">Company Name</label>
              <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required autoFocus placeholder="PT Maju Bersama" />
            </div>
            <div>
              <label className="label">Slug</label>
              <input className="input font-mono text-xs" value={form.slug} onChange={e => setForm(f => ({ ...f, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') }))} required placeholder="pt-maju-bersama" />
            </div>
            <div>
              <label className="label">Status</label>
              <select className="select" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="suspended">Suspended</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="label">Logo</label>
              <div className="space-y-3">
                <div
                  className="w-full rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden hover:border-brand/30 transition-colors cursor-pointer"
                  style={{ aspectRatio: '16/9' }}
                  onClick={() => logoInputRef.current?.click()}
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => { e.preventDefault(); handleLogoPick(e.dataTransfer.files?.[0]) }}
                >
                  {form.logoPreview
                    ? <img src={form.logoPreview} alt="Logo preview" className="w-full h-full object-contain bg-white" />
                    : <div className="text-center p-6"><ImageIcon size={28} className="mx-auto text-slate-300 mb-2" /><p className="text-xs text-slate-400 font-medium">Drop logo di sini</p><p className="text-xs text-slate-300 mt-1">atau klik untuk memilih</p></div>}
                </div>
                <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={e => handleLogoPick(e.target.files?.[0])} />
                <button type="button" onClick={() => logoInputRef.current?.click()} className="btn-secondary w-full text-xs justify-center">
                  <Upload size={12} /> {form.logoPreview ? 'Ganti Logo' : 'Upload Logo'}
                </button>
              </div>
            </div>
            <div className="col-span-2">
              <label className="label">Subscription Expires At</label>
              <input className="input" type="date" value={form.subscriptionExpiresAt} onChange={e => setForm(f => ({ ...f, subscriptionExpiresAt: e.target.value }))} />
            </div>
          </div>
          <div className="flex gap-2 pt-2 border-t border-slate-100">
            <button type="button" onClick={() => setModal(null)} className="btn-secondary flex-1 justify-center">Cancel</button>
            <button type="submit" disabled={save.isPending} className="btn-primary flex-1 justify-center">{save.isPending ? 'Saving…' : 'Save Company'}</button>
          </div>
        </form>
      </Modal>

      <Modal open={modal?.mode === 'delete'} onClose={() => setModal(null)} title="Hapus Perusahaan" size="sm">
        <p className="text-sm text-slate-600 mb-2">Hapus <span className="font-semibold text-slate-800">"{ modal?.data?.name}"</span>?</p>
        <p className="text-xs text-danger font-semibold mb-5">Semua data terkait akan dihapus secara permanen.</p>
        <div className="flex gap-2">
          <button onClick={() => setModal(null)} className="btn-secondary flex-1 justify-center">Batal</button>
          <button onClick={() => del.mutate(modal.data.id)} disabled={del.isPending} className="btn-danger flex-1 justify-center">{del.isPending ? 'Menghapus…' : 'Hapus'}</button>
        </div>
      </Modal>
    </div>
  )
}
