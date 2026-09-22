import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { vendorsApi } from '../api'
import PageHeader from '../components/PageHeader'
import { Table, Pagination } from '../components/Table'
import Modal from '../components/Modal'
import { useCompanyGuard } from '../hooks/useCompanyGuard'
import CompanyRequiredBanner from '../components/CompanyRequiredBanner'
import toast from 'react-hot-toast'
import { Plus, Pencil, Trash2, Building2 } from 'lucide-react'

const EMPTY = { name: '', vendorCode: '', contact: '', phone: '', email: '', address: '' }

export default function Vendors() {
  const qc = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const page  = Number(searchParams.get('page')  || '1')
  const limit = Number(searchParams.get('limit') || '15')
  const setPage = (p) => setSearchParams(prev => { prev.set('page', String(p)); return prev }, { replace: true })
  const [modal, setModal] = useState(null)
  const [form, setForm]   = useState(EMPTY)
  const { needsCompany } = useCompanyGuard()

  const { data, isLoading } = useQuery({
    queryKey: ['vendors', { page, limit }],
    queryFn:  () => vendorsApi.list({ page, limit }),
  })

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }))

  const onSuccess = (msg) => {
    qc.invalidateQueries({ queryKey: ['vendors'] })
    toast.success(msg)
    setModal(null)
  }

  const createMut = useMutation({
    mutationFn: vendorsApi.create,
    onSuccess: () => onSuccess('Vendor berhasil ditambahkan'),
    onError: e => toast.error(e.response?.data?.message || 'Error'),
  })
  const updateMut = useMutation({
    mutationFn: ({ id, data }) => vendorsApi.update(id, data),
    onSuccess: () => onSuccess('Vendor berhasil diupdate'),
    onError: e => toast.error(e.response?.data?.message || 'Error'),
  })
  const deleteMut = useMutation({
    mutationFn: vendorsApi.remove,
    onSuccess: () => onSuccess('Vendor dihapus'),
    onError: e => toast.error(e.response?.data?.message || 'Error'),
  })

  const openCreate = () => { setForm(EMPTY); setModal('create') }
  const openEdit   = (row) => { setForm({ ...EMPTY, ...row }); setModal({ mode: 'edit', id: row.id }) }
  const handleDelete = (row) => {
    if (!confirm(`Hapus vendor "${row.name}"?`)) return
    deleteMut.mutate(row.id)
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (modal === 'create') createMut.mutate(form)
    else updateMut.mutate({ id: modal.id, data: form })
  }

  const columns = [
    { key: 'vendorCode', label: 'Kode',    width: 130, render: r => <span className="font-mono text-xs font-semibold text-slate-600">{r.vendorCode}</span> },
    { key: 'name',       label: 'Nama',               render: r => <span className="font-semibold text-slate-800">{r.name}</span> },
    { key: 'contact',    label: 'Kontak',              render: r => <span className="text-slate-500">{r.contact || '—'}</span> },
    { key: 'phone',      label: 'Telepon',             render: r => <span className="text-slate-500">{r.phone || '—'}</span> },
    { key: 'email',      label: 'Email',               render: r => <span className="text-slate-500">{r.email || '—'}</span> },
    {
      key: 'actions', label: '', width: 80,
      render: r => (
        <div className="flex items-center gap-1">
          <button onClick={() => openEdit(r)} className="btn-edit"><Pencil size={12} /></button>
          <button onClick={() => handleDelete(r)} className="p-1.5 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"><Trash2 size={12} /></button>
        </div>
      ),
    },
  ]

  const isPending = createMut.isPending || updateMut.isPending

  return (
    <div className="px-6 py-6">
      {needsCompany && <div className="mb-4"><CompanyRequiredBanner action="menambah vendor" /></div>}
      <PageHeader
        title="Vendors"
        subtitle={`${data?.pagination?.total ?? 0} vendor terdaftar`}
        action={
          <button onClick={openCreate} className="btn-primary">
            <Plus size={14} /> Tambah Vendor
          </button>
        }
      />

      <div className="card overflow-hidden">
        <Table columns={columns} data={data?.data} loading={isLoading} emptyText="Belum ada vendor" />
        <Pagination pagination={data?.pagination} onPageChange={setPage} />
      </div>

      <Modal
        open={!!modal}
        onClose={() => setModal(null)}
        title={modal === 'create' ? 'Tambah Vendor' : 'Edit Vendor'}
        size="md"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Nama <span className="text-danger">*</span></label>
              <input className="input" value={form.name} onChange={set('name')} required placeholder="PT Sumber Makmur" />
            </div>
            <div>
              <label className="label">Kode Vendor <span className="text-danger">*</span></label>
              <input className="input font-mono" value={form.vendorCode} onChange={set('vendorCode')} required placeholder="VND-001" />
            </div>
            <div>
              <label className="label">Nama PIC Kontak</label>
              <input className="input" value={form.contact} onChange={set('contact')} placeholder="Budi Santoso" />
            </div>
            <div>
              <label className="label">Telepon</label>
              <input className="input" value={form.phone} onChange={set('phone')} placeholder="0812345678" />
            </div>
            <div>
              <label className="label">Email</label>
              <input className="input" type="email" value={form.email} onChange={set('email')} placeholder="pic@vendor.com" />
            </div>
            <div>
              <label className="label">Alamat</label>
              <input className="input" value={form.address} onChange={set('address')} placeholder="Jl. Industri No. 10" />
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={() => setModal(null)} className="btn-secondary flex-1 justify-center">Batal</button>
            <button type="submit" disabled={isPending} className="btn-primary flex-1 justify-center">
              <Building2 size={14} /> {isPending ? 'Menyimpan…' : 'Simpan'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
