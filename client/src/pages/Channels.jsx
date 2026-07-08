import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { channelsApi } from '../api'
import PageHeader from '../components/PageHeader'
import { Table, Pagination } from '../components/Table'
import Modal from '../components/Modal'
import SearchBar from '../components/SearchBar'
import toast from 'react-hot-toast'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { useCompanyGuard } from '../hooks/useCompanyGuard'
import CompanyRequiredBanner from '../components/CompanyRequiredBanner'
import { useAuth } from '../context/AuthContext'

export default function Channels() {
  const qc = useQueryClient()
  const { needsCompany } = useCompanyGuard()
  const { hasPermission } = useAuth()
  const canManage = hasPermission('channel.manage')
  const [searchParams, setSearchParams] = useSearchParams()
  const page  = Number(searchParams.get('page')  || '1')
  const limit = Number(searchParams.get('limit') || '10')
  const setPage = (p) => setSearchParams(prev => { prev.set('page', String(p)); return prev }, { replace: true })
  const [search, setSearch] = useState('')
  const [modal, setModal]   = useState(null)
  const [form, setForm]     = useState({ name: '', isActive: true })

  const { data, isLoading } = useQuery({
    queryKey: ['channels', { page, limit, name: search }],
    queryFn:  () => channelsApi.list({ page, limit, name: search }),
  })

  const save = useMutation({
    mutationFn: d => modal.data ? channelsApi.update(modal.data.id, d) : channelsApi.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['channels'] }); toast.success(modal.data ? 'Channel diperbarui' : 'Channel ditambahkan'); setModal(null) },
    onError: e => toast.error(e.response?.data?.message || 'Error'),
  })
  const del = useMutation({
    mutationFn: id => channelsApi.remove(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['channels'] }); toast.success('Channel dihapus'); setModal(null) },
    onError: e => toast.error(e.response?.data?.message || 'Error'),
  })

  const columns = [
    { key: 'name', label: 'Channel', render: r => <span className="font-semibold text-slate-800">{r.name}</span> },
    { key: 'status', label: 'Status', width: 110, render: r => (
      r.isActive
        ? <span className="badge-green">Aktif</span>
        : <span className="badge-muted">Nonaktif</span>
    )},
    { key: 'actions', label: '', width: 90, render: r => (
      <div className="flex items-center gap-1 justify-end">
        {canManage && <button onClick={() => { setForm({ name: r.name, isActive: r.isActive }); setModal({ mode: 'edit', data: r }) }} className="p-1.5 rounded text-slate-400 btn-edit transition-colors"><Pencil size={13} /></button>}
        {canManage && <button onClick={() => setModal({ mode: 'delete', data: r })} className="p-1.5 rounded text-slate-400 hover:text-danger hover:bg-danger-light transition-colors"><Trash2 size={13} /></button>}
      </div>
    )},
  ]

  return (
    <div className="px-6 py-6">
      <PageHeader title="Channel Jualan" subtitle={`${data?.pagination?.total ?? 0} channel`}
        action={canManage && (
          <button
            onClick={() => {
              if (needsCompany) return toast.error('Pilih perusahaan terlebih dahulu')
              setForm({ name: '', isActive: true }); setModal({ mode: 'create' })
            }}
            className="btn-primary"
          >
            <Plus size={14} />Channel Baru
          </button>
        )}
      />
      {needsCompany && <div className="mb-4"><CompanyRequiredBanner action="menambah channel" /></div>}
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
          <SearchBar value={search} onChange={v => { setSearch(v); setPage(1) }} placeholder="Cari channel…" />
        </div>
        <Table columns={columns} data={data?.data} loading={isLoading} />
        <Pagination pagination={data?.pagination} onPageChange={setPage} />
      </div>

      <Modal open={['create','edit'].includes(modal?.mode)} onClose={() => setModal(null)}
        title={modal?.mode === 'edit' ? 'Edit Channel' : 'Channel Baru'}>
        <form onSubmit={e => { e.preventDefault(); save.mutate(form) }} className="space-y-4">
          <div>
            <label className="label">Nama Channel</label>
            <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required autoFocus placeholder="mis. Shopee, Website" />
          </div>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" checked={form.isActive} onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))}
              className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
            <span className="text-sm text-slate-600">Aktif (muncul di pilihan publikasi produk)</span>
          </label>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={() => setModal(null)} className="btn-secondary flex-1 justify-center">Batal</button>
            <button type="submit" disabled={save.isPending} className="btn-primary flex-1 justify-center">{save.isPending ? 'Menyimpan…' : 'Simpan'}</button>
          </div>
        </form>
      </Modal>

      <Modal open={modal?.mode === 'delete'} onClose={() => setModal(null)} title="Hapus Channel" size="sm">
        <p className="text-sm text-slate-600 mb-5">Hapus <span className="font-semibold text-slate-800">"{modal?.data?.name}"</span>? Data publikasi SKU di channel ini juga akan terhapus. Tidak bisa dibatalkan.</p>
        <div className="flex gap-2">
          <button onClick={() => setModal(null)} className="btn-secondary flex-1 justify-center">Batal</button>
          <button onClick={() => del.mutate(modal.data.id)} disabled={del.isPending} className="btn-danger flex-1 justify-center">{del.isPending ? 'Menghapus…' : 'Hapus'}</button>
        </div>
      </Modal>
    </div>
  )
}
