import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { tasksApi, usersApi } from '../api'
import PageHeader from '../components/PageHeader'
import { Table, Pagination } from '../components/Table'
import Modal from '../components/Modal'
import SearchBar from '../components/SearchBar'
import toast from 'react-hot-toast'
import { Plus, Pencil, Trash2, MessageSquare, Send } from 'lucide-react'

const STATUS_CONFIG = {
  TODO:        { label: 'To Do',       cls: 'bg-slate-100 text-slate-600' },
  IN_PROGRESS: { label: 'In Progress', cls: 'bg-blue-50 text-blue-600' },
  DONE:        { label: 'Done',        cls: 'bg-green-50 text-green-600' },
}
const PRIORITY_CONFIG = {
  LOW:    { label: 'Low',    cls: 'bg-slate-100 text-slate-500' },
  MEDIUM: { label: 'Medium', cls: 'bg-blue-50 text-blue-600' },
  HIGH:   { label: 'High',   cls: 'bg-red-50 text-red-600' },
}

const EMPTY_FORM = { title: '', description: '', status: 'TODO', priority: 'MEDIUM', dueDate: '', assigneeId: '' }

function Badge({ cls, children }) {
  return <span className={`inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full ${cls}`}>{children}</span>
}

export default function Tasks() {
  const qc = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const page  = Number(searchParams.get('page')  || '1')
  const limit = Number(searchParams.get('limit') || '10')
  const setPage = (p) => setSearchParams(prev => { prev.set('page', String(p)); return prev }, { replace: true })

  const [status, setStatus]     = useState('')
  const [priority, setPriority] = useState('')
  const [mineOnly, setMineOnly] = useState(false)

  const [modal, setModal] = useState(null)
  const [form, setForm]   = useState(EMPTY_FORM)
  const [commentsTask, setCommentsTask] = useState(null)
  const [commentText, setCommentText]   = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['tasks', { page, limit, status, priority, mine: mineOnly }],
    queryFn:  () => tasksApi.list({ page, limit, status: status || undefined, priority: priority || undefined, mine: mineOnly ? 'true' : undefined }),
  })

  const { data: users } = useQuery({
    queryKey: ['users', 'for-tasks'],
    queryFn:  () => usersApi.list({ limit: 500 }),
  })
  const userOptions = users?.data ?? []

  const save = useMutation({
    mutationFn: d => modal.data ? tasksApi.update(modal.data.id, d) : tasksApi.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tasks'] }); toast.success(modal.data ? 'Task diperbarui' : 'Task dibuat'); setModal(null) },
    onError: e => toast.error(e.response?.data?.message || 'Error'),
  })
  const del = useMutation({
    mutationFn: id => tasksApi.remove(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tasks'] }); toast.success('Task dihapus'); setModal(null) },
    onError: e => toast.error(e.response?.data?.message || 'Error'),
  })
  const quickStatus = useMutation({
    mutationFn: ({ id, status }) => tasksApi.update(id, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
    onError: e => toast.error(e.response?.data?.message || 'Error'),
  })

  const { data: comments } = useQuery({
    enabled: !!commentsTask,
    queryKey: ['task-comments', commentsTask?.id],
    queryFn:  () => tasksApi.listComments(commentsTask.id),
  })
  const addComment = useMutation({
    mutationFn: (content) => tasksApi.addComment(commentsTask.id, content),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['task-comments', commentsTask.id] }); setCommentText('') },
    onError: e => toast.error(e.response?.data?.message || 'Error'),
  })

  const columns = [
    { key: 'title', label: 'Task', render: r => (
      <div>
        <p className="font-semibold text-slate-800 text-sm">{r.title}</p>
        {r.description && <p className="text-xs text-slate-400 truncate max-w-xs">{r.description}</p>}
      </div>
    )},
    { key: 'status', label: 'Status', width: 130, render: r => (
      <select
        value={r.status}
        onChange={e => quickStatus.mutate({ id: r.id, status: e.target.value })}
        className={`text-[11px] font-semibold rounded-full px-2 py-0.5 border-0 outline-none cursor-pointer ${STATUS_CONFIG[r.status].cls}`}
      >
        {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
      </select>
    )},
    { key: 'priority', label: 'Priority', width: 100, render: r => <Badge cls={PRIORITY_CONFIG[r.priority].cls}>{PRIORITY_CONFIG[r.priority].label}</Badge> },
    { key: 'assignee', label: 'Assignee', width: 140, render: r => <span className="text-sm text-slate-600">{r.assignee?.name || '—'}</span> },
    { key: 'dueDate', label: 'Due Date', width: 110, render: r => <span className="text-sm text-slate-500">{r.dueDate || '—'}</span> },
    { key: 'actions', label: '', width: 110, render: r => (
      <div className="flex gap-1">
        <button onClick={() => setCommentsTask(r)} className="p-1.5 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"><MessageSquare size={13} /></button>
        <button onClick={() => {
          setForm({ title: r.title, description: r.description || '', status: r.status, priority: r.priority, dueDate: r.dueDate || '', assigneeId: r.assigneeId || '' })
          setModal({ mode: 'edit', data: r })
        }} className="p-1.5 rounded text-slate-400 btn-edit transition-colors"><Pencil size={13} /></button>
        <button onClick={() => setModal({ mode: 'delete', data: r })} className="p-1.5 rounded text-slate-400 hover:text-danger hover:bg-danger-light transition-colors"><Trash2 size={13} /></button>
      </div>
    )},
  ]

  return (
    <div className="px-6 py-6">
      <PageHeader title="Tugas" subtitle={`${data?.pagination?.total ?? 0} task`}
        action={
          <button onClick={() => { setForm(EMPTY_FORM); setModal({ mode: 'create' }) }} className="btn-primary">
            <Plus size={14} />Task Baru
          </button>
        }
      />

      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50 flex flex-wrap items-center gap-3">
          <select value={status} onChange={e => { setStatus(e.target.value); setPage(1) }} className="input text-sm w-auto">
            <option value="">Semua Status</option>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <select value={priority} onChange={e => { setPriority(e.target.value); setPage(1) }} className="input text-sm w-auto">
            <option value="">Semua Priority</option>
            {Object.entries(PRIORITY_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <label className="flex items-center gap-1.5 text-sm text-slate-600 cursor-pointer select-none ml-auto">
            <input type="checkbox" checked={mineOnly} onChange={e => { setMineOnly(e.target.checked); setPage(1) }} className="accent-slate-700" />
            Assigned to Me
          </label>
        </div>
        <Table columns={columns} data={data?.data} loading={isLoading} emptyText="Belum ada task" />
        <Pagination pagination={data?.pagination} onPageChange={setPage} />
      </div>

      {/* Create/Edit modal */}
      <Modal open={['create', 'edit'].includes(modal?.mode)} onClose={() => setModal(null)}
        title={modal?.mode === 'edit' ? 'Edit Task' : 'Task Baru'}>
        <form onSubmit={e => { e.preventDefault(); save.mutate({ ...form, dueDate: form.dueDate || null, assigneeId: form.assigneeId || null }) }} className="space-y-4">
          <div>
            <label className="label">Judul</label>
            <input className="input" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required autoFocus placeholder="cth. Follow up vendor A" />
          </div>
          <div>
            <label className="label">Deskripsi</label>
            <textarea className="input" rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Detail tambahan (opsional)" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Status</label>
              <select className="input" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Priority</label>
              <select className="input" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
                {Object.entries(PRIORITY_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Due Date</label>
              <input type="date" className="input" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} />
            </div>
            <div>
              <label className="label">Assignee</label>
              <select className="input" value={form.assigneeId} onChange={e => setForm(f => ({ ...f, assigneeId: e.target.value }))}>
                <option value="">Tidak ditugaskan</option>
                {userOptions.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={() => setModal(null)} className="btn-secondary flex-1 justify-center">Batal</button>
            <button type="submit" disabled={save.isPending} className="btn-primary flex-1 justify-center">{save.isPending ? 'Menyimpan…' : 'Simpan'}</button>
          </div>
        </form>
      </Modal>

      {/* Delete confirm */}
      <Modal open={modal?.mode === 'delete'} onClose={() => setModal(null)} title="Hapus Task" size="sm">
        <p className="text-sm text-slate-600 mb-4">Yakin ingin menghapus task <strong>{modal?.data?.title}</strong>? Tindakan ini tidak bisa dibatalkan.</p>
        <div className="flex gap-2">
          <button onClick={() => setModal(null)} className="btn-secondary flex-1 justify-center">Batal</button>
          <button onClick={() => del.mutate(modal.data.id)} disabled={del.isPending} className="btn-danger flex-1 justify-center">{del.isPending ? 'Menghapus…' : 'Hapus'}</button>
        </div>
      </Modal>

      {/* Comments */}
      <Modal open={!!commentsTask} onClose={() => { setCommentsTask(null); setCommentText('') }} title={`Komentar — ${commentsTask?.title ?? ''}`}>
        <div className="space-y-3 max-h-80 overflow-y-auto mb-4">
          {!comments?.length ? (
            <p className="text-sm text-slate-400 text-center py-6">Belum ada komentar</p>
          ) : comments.map(c => (
            <div key={c.id} className="text-sm">
              <div className="flex items-baseline gap-2">
                <span className="font-semibold text-slate-700">{c.user?.name}</span>
                <span className="text-[11px] text-slate-400">{new Date(c.createdAt).toLocaleString('id-ID')}</span>
              </div>
              <p className="text-slate-600">{c.content}</p>
            </div>
          ))}
        </div>
        <form onSubmit={e => { e.preventDefault(); if (commentText.trim()) addComment.mutate(commentText.trim()) }} className="flex gap-2">
          <input className="input flex-1" value={commentText} onChange={e => setCommentText(e.target.value)} placeholder="Tulis komentar…" />
          <button type="submit" disabled={addComment.isPending} className="btn-primary px-3"><Send size={14} /></button>
        </form>
      </Modal>
    </div>
  )
}
