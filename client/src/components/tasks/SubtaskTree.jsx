import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { ChevronRight, Check, Plus, ListTree } from 'lucide-react'
import { tasksApi } from '../../api'
import { fmtDue } from './taskConfig'

// Safety cap against pathological nesting (accidental self/circular parenting) —
// past this depth, rows can still be opened via onOpenTask but no longer expand.
const MAX_DEPTH = 6

// Recursive sub-task list: each row can itself be expanded to reveal its own
// sub-tasks, so "sub-task punya detail lagi" works at any depth. Reused both
// inline under a task row (List/Table view, Product→SKU-style accordion) and
// inside TaskDetailPanel's Sub-tasks section — callers decide what "open"
// means via onOpenTask (drill into the same panel, or open a fresh one).
export default function SubtaskTree({ parentId, onOpenTask, depth = 0 }) {
  const qc = useQueryClient()
  const [expandedIds, setExpandedIds] = useState(new Set())
  const [newTitle, setNewTitle] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['task-subtasks', parentId],
    queryFn: () => tasksApi.listSubtasks(parentId),
    enabled: !!parentId,
  })
  const subtasks = data?.data ?? []

  function invalidate() {
    qc.invalidateQueries({ queryKey: ['task-subtasks', parentId] })
    qc.invalidateQueries({ queryKey: ['tasks'] })
    qc.invalidateQueries({ queryKey: ['task-detail'] })
  }

  const addSubtask = useMutation({
    mutationFn: (title) => tasksApi.create({ title, parentTaskId: parentId }),
    onSuccess: () => { invalidate(); setNewTitle('') },
    onError: e => toast.error(e.response?.data?.message || 'Error'),
  })
  const toggleDone = useMutation({
    mutationFn: ({ id, status }) => tasksApi.update(id, { status }),
    // Optimistic so the checkbox/strike-through reacts instantly — completing
    // a sub-task can also bump the parent to In Progress server-side, which
    // only shows up after the invalidation below settles.
    onMutate: async ({ id, status }) => {
      const key = ['task-subtasks', parentId]
      await qc.cancelQueries({ queryKey: key })
      const prev = qc.getQueryData(key)
      qc.setQueryData(key, (old) => old && {
        ...old,
        data: old.data.map(t => t.id === id ? { ...t, status } : t),
      })
      return { prev }
    },
    onError: (e, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(['task-subtasks', parentId], ctx.prev)
      toast.error(e.response?.data?.message || 'Error')
    },
    onSettled: invalidate,
  })

  function handleToggleDone(st) {
    const nextStatus = st.status === 'DONE' ? 'TODO' : 'DONE'
    toggleDone.mutate({ id: st.id, status: nextStatus })
    // Reversible via a few-second Undo toast instead of a blocking confirm
    // dialog — checking off sub-tasks happens too often to interrupt every time.
    if (nextStatus === 'DONE') {
      toast((t) => (
        <span className="flex items-center gap-2.5">
          Sub-task selesai
          <button
            onClick={() => { toggleDone.mutate({ id: st.id, status: 'TODO' }); toast.dismiss(t.id) }}
            className="font-semibold underline underline-offset-2"
          >
            Undo
          </button>
        </span>
      ), { duration: 4000 })
    }
  }

  function toggleExpand(id) {
    setExpandedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  return (
    <div className={depth > 0 ? 'pl-4 ml-1.5 mt-1 border-l border-slate-100 space-y-0.5' : 'space-y-0.5'}>
      {isLoading ? (
        <p className="text-xs text-slate-300 py-1">Memuat…</p>
      ) : (
        <>
          {subtasks.length === 0 && (
            <p className="text-xs text-slate-300 py-1">Belum ada sub-task</p>
          )}
          {subtasks.map(st => {
            const done = st.status === 'DONE'
            const isOpen = expandedIds.has(st.id)
            const due = fmtDue(st.dueDate)
            return (
              <div key={st.id}>
                <div className="group flex items-center gap-1.5 py-1">
                  {depth < MAX_DEPTH ? (
                    <button
                      onClick={() => toggleExpand(st.id)}
                      title={isOpen ? 'Tutup sub-task' : 'Lihat sub-task'}
                      className={`w-4 h-4 flex items-center justify-center flex-shrink-0 text-slate-300 hover:text-slate-500 transition-transform ${isOpen ? 'rotate-90' : ''}`}
                    >
                      <ChevronRight size={12} />
                    </button>
                  ) : <span className="w-4 flex-shrink-0" />}
                  <button
                    onClick={() => handleToggleDone(st)}
                    title={done ? 'Tandai belum selesai' : 'Tandai selesai'}
                    className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                      done ? 'bg-success border-success' : 'border-slate-300 hover:border-success'
                    }`}
                  >
                    {done && <Check size={9} className="text-white" strokeWidth={3.5} />}
                  </button>
                  <button
                    onClick={() => onOpenTask(st)}
                    className={`text-sm flex-1 min-w-0 text-left truncate hover:underline ${done ? 'text-slate-400 line-through' : 'text-slate-700'}`}
                  >
                    {st.title}
                  </button>
                  {Number(st.subTaskCount) > 0 && (
                    <span className="inline-flex items-center gap-0.5 text-[10px] text-slate-400 flex-shrink-0">
                      <ListTree size={10} />{st.subTaskCount}
                    </span>
                  )}
                  {due && (
                    <span className={`text-[10px] flex-shrink-0 ${due.overdue ? 'text-danger font-medium' : 'text-slate-400'}`}>{due.text}</span>
                  )}
                </div>
                {isOpen && <SubtaskTree parentId={st.id} onOpenTask={onOpenTask} depth={depth + 1} />}
              </div>
            )
          })}
        </>
      )}
      <form
        onSubmit={e => { e.preventDefault(); if (newTitle.trim()) addSubtask.mutate(newTitle.trim()) }}
        className="flex gap-2 pt-0.5"
      >
        <input
          className="input text-xs py-1 flex-1"
          value={newTitle}
          onChange={e => setNewTitle(e.target.value)}
          placeholder="Tambah sub-task…"
        />
        <button type="submit" disabled={addSubtask.isPending} className="btn-secondary px-2 py-1"><Plus size={12} /></button>
      </form>
    </div>
  )
}
