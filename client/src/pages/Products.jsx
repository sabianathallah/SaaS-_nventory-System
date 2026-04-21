import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { productsApi, categoriesApi } from '../api'
import PageHeader from '../components/PageHeader'
import { Table, Pagination } from '../components/Table'
import Modal from '../components/Modal'
import SearchBar from '../components/SearchBar'
import toast from 'react-hot-toast'
import { Plus, Pencil, Trash2 } from 'lucide-react'

const EMPTY = { name: '', sku: '', barcode: '', qrString: '', unit: '', CategoryId: '' }

export default function Products() {
  const qc = useQueryClient()
  const [page, setPage]     = useState(1)
  const [search, setSearch] = useState('')
  const [catFilter, setCat] = useState('')
  const [modal, setModal]   = useState(null)
  const [form, setForm]     = useState(EMPTY)

  const { data, isLoading } = useQuery({
    queryKey: ['products', { page, name: search, CategoryId: catFilter }],
    queryFn:  () => productsApi.list({ page, limit: 10, name: search, CategoryId: catFilter || undefined }),
  })
  const { data: cats } = useQuery({
    queryKey: ['categories', { limit: 100 }],
    queryFn:  () => categoriesApi.list({ limit: 100 }),
  })

  const save = useMutation({
    mutationFn: d => modal.data ? productsApi.update(modal.data.id, d) : productsApi.create(d),
    onSuccess: () => { qc.invalidateQueries(['products']); toast.success(modal.data ? 'Product updated' : 'Product created'); setModal(null) },
    onError: e => toast.error(e.response?.data?.message || 'Error'),
  })
  const del = useMutation({
    mutationFn: id => productsApi.remove(id),
    onSuccess: () => { qc.invalidateQueries(['products']); toast.success('Product deleted'); setModal(null) },
    onError: e => toast.error(e.response?.data?.message || 'Error'),
  })

  const columns = [
    { key: 'name',     label: 'Product',  render: r => (
      <div>
        <p className="font-semibold text-slate-800">{r.name}</p>
        <p className="text-xs font-mono text-slate-400">{r.sku}</p>
      </div>
    )},
    { key: 'category', label: 'Category', render: r => r.Category ? <span className="badge-teal">{r.Category.name}</span> : <span className="text-slate-300">—</span> },
    { key: 'barcode',  label: 'Barcode',  render: r => <span className="font-mono text-xs text-slate-500">{r.barcode || '—'}</span> },
    { key: 'unit',     label: 'Unit',     width: 80, render: r => <span className="badge-muted">{r.unit}</span> },
    { key: 'actions',  label: '', width: 80, render: r => (
      <div className="flex gap-1">
        <button onClick={() => { setForm({ name: r.name, sku: r.sku, barcode: r.barcode, qrString: r.qrString, unit: r.unit, CategoryId: r.CategoryId }); setModal({ mode: 'edit', data: r }) }} className="p-1.5 rounded text-slate-400 btn-edit transition-colors"><Pencil size={13} /></button>
        <button onClick={() => setModal({ mode: 'delete', data: r })} className="p-1.5 rounded text-slate-400 hover:text-danger hover:bg-danger-light transition-colors"><Trash2 size={13} /></button>
      </div>
    )},
  ]

  const F = ({ k, label, type = 'text', ...rest }) => (
    <div>
      <label className="label">{label}</label>
      {type === 'select' ? (
        <select className="select" value={form[k]} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} {...rest}>
          <option value="">Select category…</option>
          {cats?.data?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      ) : (
        <input type={type} className="input" value={form[k]} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} {...rest} />
      )}
    </div>
  )

  return (
    <div className="px-6 py-6">
      <PageHeader title="Products" subtitle={`${data?.pagination?.total ?? 0} total products`}
        action={<button onClick={() => { setForm(EMPTY); setModal({ mode: 'create' }) }} className="btn-primary"><Plus size={14} />Add Product</button>}
      />

      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
          <SearchBar value={search} onChange={v => { setSearch(v); setPage(1) }} placeholder="Search products…" />
          <select className="select w-44" value={catFilter} onChange={e => { setCat(e.target.value); setPage(1) }}>
            <option value="">All categories</option>
            {cats?.data?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <Table columns={columns} data={data?.data} loading={isLoading} />
        <Pagination pagination={data?.pagination} onPageChange={setPage} />
      </div>

      <Modal open={['create','edit'].includes(modal?.mode)} onClose={() => setModal(null)}
        title={modal?.mode === 'edit' ? 'Edit Product' : 'New Product'} size="lg">
        <form onSubmit={e => { e.preventDefault(); save.mutate(form) }}>
          <div className="grid grid-cols-2 gap-4 mb-5">
            <div className="col-span-2"><F k="name" label="Product Name" required autoFocus /></div>
            <F k="sku"      label="SKU" required />
            <F k="unit"     label="Unit" placeholder="pcs, box, kg…" required />
            <F k="barcode"  label="Barcode" required />
            <F k="qrString" label="QR String" required />
            <div className="col-span-2"><F k="CategoryId" label="Category" type="select" required /></div>
          </div>
          <div className="flex gap-2 pt-4 border-t border-slate-100">
            <button type="button" onClick={() => setModal(null)} className="btn-secondary flex-1 justify-center">Cancel</button>
            <button type="submit" disabled={save.isPending} className="btn-primary flex-1 justify-center">{save.isPending ? 'Saving…' : 'Save Product'}</button>
          </div>
        </form>
      </Modal>

      <Modal open={modal?.mode === 'delete'} onClose={() => setModal(null)} title="Delete Product" size="sm">
        <p className="text-sm text-slate-600 mb-5">Delete <span className="font-semibold text-slate-800">"{modal?.data?.name}"</span>? This cannot be undone.</p>
        <div className="flex gap-2">
          <button onClick={() => setModal(null)} className="btn-secondary flex-1 justify-center">Cancel</button>
          <button onClick={() => del.mutate(modal.data.id)} disabled={del.isPending} className="btn-danger flex-1 justify-center">{del.isPending ? 'Deleting…' : 'Delete'}</button>
        </div>
      </Modal>
    </div>
  )
}
