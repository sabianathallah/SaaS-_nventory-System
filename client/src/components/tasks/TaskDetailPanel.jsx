import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { tasksApi, taskListsApi } from '../../api'
import { useAuth } from '../../context/AuthContext'
import toast from 'react-hot-toast'
import { X, Send, Star, Sun, Trash2, ChevronLeft } from 'lucide-react'
import { STATUS_CONFIG, PRIORITY_CONFIG, RECURRENCE_CONFIG, ASSIGNMENT_STATUS_CONFIG, avatarColor, initials } from './taskConfig'
import DescriptionEditor from './DescriptionEditor'
import AssigneeMultiSelect from './AssigneeMultiSelect'
import TaskAttachments from './TaskAttachments'
import SubtaskTree from './SubtaskTree'

// `rootTask` is whatever the caller opened (a top-level task most of the
// time). Clicking into a sub-task's own detail (a sub-task can have detail
// "kembali", recursively) pushes onto `drillStack` instead of navigating
// away — same panel, same close button, just a breadcrumb back to the parent.
export default function TaskDetailPanel({ task: rootTask, userOptions, onClose }) {
  const qc = useQueryClient()
  const { user, hasPermission, isSuperAdmin, isAdmin } = useAuth()
  const [tab, setTab] = useState('details')
  const [form, setForm] = useState(null)
  const [commentText, setCommentText] = useState('')
  const [rejectNote, setRejectNote] = useState(null) // null = not composing, string = textarea open
  const [syncedId, setSyncedId] = useState(null)
  const [syncedRootId, setSyncedRootId] = useState(null)
  const [drillStack, setDrillStack] = useState([]) // [{ id, title }, …]

  // A newly-opened root task always starts back at its own detail, not
  // wherever the previous task's drill-down happened to leave off.
  if (rootTask && rootTask.id !== syncedRootId) {
    setSyncedRootId(rootTask.id)
    setDrillStack([])
  }

  const currentId = drillStack.length ? drillStack[drillStack.length - 1].id : rootTask?.id

  const { data: task } = useQuery({
    queryKey: ['task-detail', currentId],
    queryFn: () => tasksApi.get(currentId),
    enabled: !!currentId,
    initialData: () => (currentId === rootTask?.id ? rootTask : undefined),
  })

  function closePanel() {
    setDrillStack([])
    onClose()
  }

  function openSubtask(st) {
    setDrillStack(s => [...s, { id: st.id, title: st.title }])
  }

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
      assigneeIds: (task.assignees ?? []).map(a => a.id),
      listId: task.listId || '',
      tags: (task.tags ?? []).join(', '),
      reminderAt: task.reminderAt ? task.reminderAt.slice(0, 16) : '',
      recurrence: task.recurrence || 'NONE',
    })
    setTab('details')
    setRejectNote(null)
  }

  const { data: lists } = useQuery({
    queryKey: ['task-lists', task?.divisi],
    queryFn: () => taskListsApi.list({ divisi: task.divisi }),
    enabled: !!task?.divisi,
  })

  const save = useMutation({
    mutationFn: (patch) => tasksApi.update(task.id, patch),
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: ['tasks'] })
      qc.invalidateQueries({ queryKey: ['task-detail'] })
      // Picking a recurrence can auto-default dueDate/myDayDate server-side
      // (see taskController.update) — reflect that back into the form so the
      // Due Date field doesn't look stale until the panel is reopened.
      field({ dueDate: updated.dueDate || '', recurrence: updated.recurrence || 'NONE' })
      toast.success('Task diperbarui')
    },
    onError: (e, patch) => {
      // Roll the local form field back to the task's last known-good value —
      // otherwise e.g. a rejected "mark as DONE" (blocked by open sub-tasks)
      // leaves the <select> visually showing DONE even though it didn't save.
      const key = Object.keys(patch)[0]
      if (key === 'assigneeIds') field({ assigneeIds: (task.assignees ?? []).map(a => a.id) })
      else if (key && task[key] !== undefined) field({ [key]: key === 'tags' ? (task.tags ?? []).join(', ') : (task[key] ?? '') })
      toast.error(e.response?.data?.message || 'Error')
    },
  })
  const del = useMutation({
    mutationFn: () => tasksApi.remove(task.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] })
      toast.success('Task dihapus')
      // Deleting a sub-task pops back to its parent instead of closing the
      // whole panel; deleting the root task closes it like before.
      if (drillStack.length) setDrillStack(s => s.slice(0, -1))
      else closePanel()
    },
    onError: e => toast.error(e.response?.data?.message || 'Error'),
  })

  const accept = useMutation({
    mutationFn: () => tasksApi.accept(task.id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tasks'] }); qc.invalidateQueries({ queryKey: ['task-detail'] }); toast.success('Task diterima') },
    onError: e => toast.error(e.response?.data?.message || 'Error'),
  })
  const reject = useMutation({
    mutationFn: (note) => tasksApi.reject(task.id, note),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tasks'] }); qc.invalidateQueries({ queryKey: ['task-detail'] }); toast.success('Task ditolak'); setRejectNote(null) },
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

  // Only the direct-children count is needed here (for the "can't close while
  // sub-tasks are open" hint) — the actual sub-task list/add/toggle UI lives
  // in <SubtaskTree>, which shares this same query key so there's no extra request.
  const { data: subtasksRes } = useQuery({
    enabled: !!task,
    queryKey: ['task-subtasks', task?.id],
    queryFn: () => tasksApi.listSubtasks(task.id),
  })
  const subtasks = subtasksRes?.data ?? []

  if (!rootTask) return null

  function field(patch) { setForm(f => ({ ...f, ...patch })) }
  function commitField(key, value) {
    save.mutate({ [key]: value === '' ? null : value })
  }

  const loaded = task && form
  const myAssignee = loaded ? (task.assignees ?? []).find(a => a.id === user?.id) : null
  const myAssignmentStatus = myAssignee?.TaskAssignee?.assignmentStatus
  const isPendingForMe = myAssignmentStatus === 'PENDING'
  const otherAssignees = loaded ? (task.assignees ?? []).filter(a => a.id !== user?.id && a.TaskAssignee?.assignmentStatus) : []
  const openSubtasks = subtasks.filter(st => st.status !== 'DONE').length
  const canDelete = loaded && (
    isSuperAdmin || isAdmin || hasPermission('tasks.delete') || hasPermission('tasks.manage') || task.createdBy === user?.id
  )

  return (
    <>
      <div className="fixed inset-0 bg-slate-900/25 backdrop-blur-[1px] z-40 animate-fade-in" onClick={closePanel} />
      <div className={`fixed top-0 right-0 h-full w-full max-w-md bg-white shadow-modal z-50 flex flex-col animate-slide-in-right border-l-4 ${loaded ? PRIORITY_CONFIG[task.priority].border : 'border-slate-200'}`}>
        {drillStack.length > 0 && (
          <div className="flex items-center gap-1.5 px-5 pt-3 flex-shrink-0 min-w-0">
            <button
              onClick={() => setDrillStack(s => s.slice(0, -1))}
              className="flex items-center gap-0.5 text-xs font-semibold text-slate-500 hover:text-slate-700 flex-shrink-0"
            >
              <ChevronLeft size={13} />Kembali
            </button>
            <span className="text-xs text-slate-300 truncate">
              {rootTask.title}{drillStack.slice(0, -1).map(d => ` › ${d.title}`).join('')}
            </span>
          </div>
        )}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 flex-shrink-0">
          <div className="flex gap-5">
            {['details', 'comments'].map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`text-sm font-semibold pb-1 border-b-2 transition-colors ${
                  tab === t ? 'text-slate-800' : 'text-slate-400 border-transparent hover:text-slate-600'
                }`}
                style={tab === t ? { borderColor: 'var(--brand)' } : undefined}
              >
                {t === 'details' ? 'Details' : 'Comments'}
              </button>
            ))}
          </div>
          <button onClick={closePanel} className="w-7 h-7 rounded-md flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"><X size={16} /></button>
        </div>

        {!loaded ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-sm text-slate-400">Memuat…</p>
          </div>
        ) : (
        tab === 'details' ? (
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            {isPendingForMe && (
              <div className="bg-warning-light border border-warning-border rounded-lg p-3 space-y-2">
                <p className="text-xs text-slate-600">
                  <span className="font-semibold text-slate-700">{task.creator?.name}</span> menugaskan task ini kepada Anda.
                </p>
                {rejectNote === null ? (
                  <div className="flex gap-2">
                    <button
                      onClick={() => accept.mutate()}
                      disabled={accept.isPending}
                      className="btn-primary py-1.5 px-3 text-xs flex-1 justify-center"
                    >
                      Terima
                    </button>
                    <button
                      onClick={() => setRejectNote('')}
                      className="btn-secondary py-1.5 px-3 text-xs flex-1 justify-center"
                    >
                      Tolak
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <textarea
                      autoFocus
                      className="input text-xs resize-none"
                      rows={2}
                      placeholder="Alasan menolak (wajib diisi)…"
                      value={rejectNote}
                      onChange={e => setRejectNote(e.target.value)}
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => reject.mutate(rejectNote)}
                        disabled={reject.isPending || !rejectNote.trim()}
                        className="btn-danger py-1.5 px-3 text-xs flex-1 justify-center"
                      >
                        Kirim Penolakan
                      </button>
                      <button onClick={() => setRejectNote(null)} className="btn-secondary py-1.5 px-3 text-xs">Batal</button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {myAssignmentStatus && !isPendingForMe && (
              <div className={`rounded-lg p-3 text-xs ${
                myAssignmentStatus === 'REJECTED' ? 'bg-danger-light text-danger' : 'bg-success-light text-success'
              }`}>
                <p className="font-semibold">{myAssignmentStatus === 'REJECTED' ? 'Anda menolak task ini' : 'Anda menerima task ini'}</p>
                {myAssignee?.TaskAssignee?.assignmentNote && <p className="mt-0.5 text-slate-600">"{myAssignee.TaskAssignee.assignmentNote}"</p>}
              </div>
            )}

            {otherAssignees.length > 0 && (
              <div className="space-y-1">
                {otherAssignees.map(a => (
                  <div key={a.id} className="flex items-center gap-2 text-xs bg-slate-50 rounded-lg px-2.5 py-1.5">
                    <span className={`w-5 h-5 rounded-full text-white text-[9px] font-bold flex items-center justify-center flex-shrink-0 ${avatarColor(a.id)}`}>
                      {initials(a.name)}
                    </span>
                    <span className="text-slate-600 flex-1 truncate">{a.name}</span>
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0 ${ASSIGNMENT_STATUS_CONFIG[a.TaskAssignee.assignmentStatus].cls}`}>
                      {ASSIGNMENT_STATUS_CONFIG[a.TaskAssignee.assignmentStatus].label}
                    </span>
                  </div>
                ))}
              </div>
            )}

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

            <DescriptionEditor
              value={form.description}
              onChange={(v) => field({ description: v })}
              onBlur={() => commitField('description', form.description)}
            />

            {openSubtasks > 0 && form.status !== 'DONE' && (
              <p className="text-[11px] text-slate-400 -mt-2">
                {openSubtasks} sub-task belum selesai — harus beres dulu sebelum task ini bisa ditutup.
              </p>
            )}

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
                <AssigneeMultiSelect
                  value={form.assigneeIds}
                  onChange={ids => { field({ assigneeIds: ids }); save.mutate({ assigneeIds: ids }) }}
                  options={userOptions}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">List</label>
                <select className="select" value={form.listId} onChange={e => { field({ listId: e.target.value }); commitField('listId', e.target.value) }}>
                  <option value="">Tanpa list</option>
                  {(lists ?? []).map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Ulangi</label>
                <select className="select" value={form.recurrence} onChange={e => { field({ recurrence: e.target.value }); commitField('recurrence', e.target.value) }}>
                  {Object.entries(RECURRENCE_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="label">Tags</label>
              <input
                className="input"
                placeholder="pisahkan dengan koma"
                value={form.tags}
                onChange={e => field({ tags: e.target.value })}
                onBlur={() => save.mutate({ tags: form.tags.split(',').map(t => t.trim()).filter(Boolean) })}
              />
            </div>

            <div>
              <label className="label">Reminder</label>
              <input
                type="datetime-local"
                className="input"
                value={form.reminderAt}
                onChange={e => { field({ reminderAt: e.target.value }); commitField('reminderAt', e.target.value) }}
              />
            </div>

            {/* Sub-tasks — always visible here, directly under the fields
                above, instead of behind a separate tab (matches San-Group's
                task detail: everything relevant to the task on one scroll).
                Recursive: clicking a sub-task's title drills into its own
                detail (title, status, its own sub-tasks, …) in this same panel. */}
            <div className="pt-2 border-t border-slate-100">
              <label className="label mb-2">
                Sub-tasks{subtasks.length > 0 && <span className="text-slate-400 font-normal"> ({subtasks.filter(st => st.status === 'DONE').length}/{subtasks.length})</span>}
              </label>
              <SubtaskTree parentId={task.id} onOpenTask={openSubtask} />
            </div>

            <TaskAttachments task={task} canDelete={canDelete} />

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
        )
        )}
      </div>
    </>
  )
}
