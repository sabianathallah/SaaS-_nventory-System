import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { tasksApi } from '../../api'
import toast from 'react-hot-toast'
import { X, Send, Star, Sun, Trash2 } from 'lucide-react'
import { STATUS_CONFIG, PRIORITY_CONFIG, avatarColor, initials } from './taskConfig'

export default function TaskDetailPanel({ task, userOptions, onClose, canDelete }) {
  const qc = useQueryClient()
  const [tab, setTab] = useState('details')
  const [form, setForm] = useState(null)
  const [commentText, setCommentText] = useState('')
  const [syncedId, setSyncedId] = useState(null)

  // Re-derive local editable form state whenever a different task is opened —
  // done during render (not an effect) so switching tasks doesn't cascade an
  // extra render, per the "adjusting state when a prop changes" React pattern.
  if (task && task.id !== syncedId) {
    setSyncedId(task.id)
    setForm({
      title: task.title,
      description: task.description || '',
      status: task.status,
      priority: task.priority,
      dueDate: task.dueDate || '',
      assigneeId: task.assigneeId || '',
    })
    setTab('details')
  }

  const save = useMutation({
    mutationFn: (patch) => tasksApi.update(task.id, patch),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tasks'] }); toast.success('Task diperbarui') },
    onError: e => toast.error(e.response?.data?.message || 'Error'),
  })
  const del = useMutation({
    mutationFn: () => tasksApi.remove(task.id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tasks'] }); toast.success('Task dihapus'); onClose() },
    onError: e => toast.error(e.response?.data?.message || 'Error'),
  })

  const { data: comments } = useQuery({
    enabled: !!task && tab === 'comments',
    queryKey: ['task-comments', task?.id],
    queryFn: () => tasksApi.listComments(task.id),
  })
  const addComment = useMutation({
    mutationFn: (content) => tasksApi.addComment(task.id, content),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['task-comments', task.id] }); qc.invalidateQueries({ queryKey: ['tasks'] }); setCommentText('') },
    onError: e => toast.error(e.response?.data?.message || 'Error'),
  })

  if (!task || !form) return null

  function field(patch) { setForm(f => ({ ...f, ...patch })) }
  function commitField(key, value) {
    save.mutate({ [key]: value === '' ? null : value })
  }

  return (
    <>
      <div className="fixed inset-0 bg-slate-900/25 backdrop-blur-[1px] z-40 animate-fade-in" onClick={onClose} />
      <div className={`fixed top-0 right-0 h-full w-full max-w-md bg-white shadow-modal z-50 flex flex-col animate-slide-in-right border-l-4 ${PRIORITY_CONFIG[task.priority].border}`}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 flex-shrink-0">
          <div className="flex gap-5">
            {['details', 'comments'].map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`text-sm font-semibold pb-1 border-b-2 transition-colors capitalize ${
                  tab === t ? 'text-slate-800' : 'text-slate-400 border-transparent hover:text-slate-600'
                }`}
                style={tab === t ? { borderColor: 'var(--brand)' } : undefined}
              >
                {t === 'details' ? 'Details' : 'Comments'}
              </button>
            ))}
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-md flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"><X size={16} /></button>
        </div>

        {tab === 'details' ? (
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            <div className="flex items-start gap-1">
              <input
                className="flex-1 text-base font-bold text-slate-800 outline-none border-0 focus:ring-0 px-0 bg-transparent"
                value={form.title}
                onChange={e => field({ title: e.target.value })}
                onBlur={() => form.title.trim() && commitField('title', form.title.trim())}
              />
              <button
                title="Important"
                onClick={() => save.mutate({ isImportant: !task.isImportant })}
                className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${
                  task.isImportant ? 'bg-warning-light' : 'hover:bg-slate-100'
                }`}
              >
                <Star size={16} className={task.isImportant ? 'text-warning fill-warning' : 'text-slate-300'} />
              </button>
              <button
                title="My Day"
                onClick={() => save.mutate({ myDayDate: task.myDayDate ? null : new Date().toISOString().slice(0, 10) })}
                className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${
                  task.myDayDate ? 'bg-warning-light' : 'hover:bg-slate-100'
                }`}
              >
                <Sun size={16} className={task.myDayDate ? 'text-warning' : 'text-slate-300'} />
              </button>
            </div>

            <textarea
              className="input text-sm resize-none"
              rows={3}
              placeholder="Deskripsi (opsional)"
              value={form.description}
              onChange={e => field({ description: e.target.value })}
              onBlur={() => commitField('description', form.description)}
            />

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Status</label>
                <select className="select" value={form.status} onChange={e => { field({ status: e.target.value }); commitField('status', e.target.value) }}>
                  {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Priority</label>
                <select className="select" value={form.priority} onChange={e => { field({ priority: e.target.value }); commitField('priority', e.target.value) }}>
                  {Object.entries(PRIORITY_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Due Date</label>
                <input type="date" className="input" value={form.dueDate} onChange={e => { field({ dueDate: e.target.value }); commitField('dueDate', e.target.value) }} />
              </div>
              <div>
                <label className="label">Assignee</label>
                <select className="select" value={form.assigneeId} onChange={e => { field({ assigneeId: e.target.value }); commitField('assigneeId', e.target.value) }}>
                  <option value="">Tidak ditugaskan</option>
                  {userOptions.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
              <span className={`w-5 h-5 rounded-full text-white text-[9px] font-bold flex items-center justify-center flex-shrink-0 ${avatarColor(task.createdBy)}`}>
                {initials(task.creator?.name)}
              </span>
              <p className="text-xs text-slate-400">Dibuat oleh <span className="text-slate-600 font-medium">{task.creator?.name}</span></p>
            </div>

            {canDelete && (
              <button
                onClick={() => { if (confirm('Yakin ingin menghapus task ini?')) del.mutate() }}
                className="flex items-center gap-1.5 text-xs font-medium text-danger hover:bg-danger-light px-2 py-1.5 -mx-2 rounded transition-colors"
              >
                <Trash2 size={12} />Hapus task
              </button>
            )}
          </div>
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
              {!comments?.length ? (
                <p className="text-sm text-slate-400 text-center py-6">Belum ada komentar</p>
              ) : comments.map(c => (
                <div key={c.id} className="flex items-start gap-2 text-sm">
                  <span className={`w-6 h-6 rounded-full text-white text-[9px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5 ${avatarColor(c.userId)}`}>
                    {initials(c.user?.name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="font-semibold text-slate-700">{c.user?.name}</span>
                      <span className="text-[11px] text-slate-400">{new Date(c.createdAt).toLocaleString('id-ID')}</span>
                    </div>
                    <p className="text-slate-600">{c.content}</p>
                  </div>
                </div>
              ))}
            </div>
            <form
              onSubmit={e => { e.preventDefault(); if (commentText.trim()) addComment.mutate(commentText.trim()) }}
              className="flex gap-2 px-5 py-3 border-t border-slate-100 flex-shrink-0"
            >
              <input className="input flex-1" value={commentText} onChange={e => setCommentText(e.target.value)} placeholder="Tulis komentar…" />
              <button type="submit" disabled={addComment.isPending} className="btn-primary px-3"><Send size={14} /></button>
            </form>
          </div>
        )}
      </div>
    </>
  )
}
