import { useState, Fragment } from 'react'
import { ChevronUp, ChevronRight } from 'lucide-react'
import { STATUS_CONFIG, PRIORITY_CONFIG, avatarColor, initials, fmtDue } from './taskConfig'
import SubtaskTree from './SubtaskTree'

const COLUMNS = [
  { key: 'title',    label: 'Judul' },
  { key: 'status',   label: 'Status' },
  { key: 'priority', label: 'Priority' },
  { key: 'assignee', label: 'Assignee' },
  { key: 'dueDate',  label: 'Due Date' },
  { key: 'tags',     label: 'Tags' },
]

// Only title/priority/dueDate are sortable server-side (taskController's
// SORT_MAP); status/assignee/tags sort client-side-only would be misleading
// since the list is paginated, so those headers aren't clickable.
const SORTABLE = new Set(['title', 'priority', 'dueDate'])

export default function TableView({ tasks, sortBy, onSortChange, onOpen }) {
  const [expandedIds, setExpandedIds] = useState(new Set())

  function toggleExpand(id) {
    setExpandedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200">
            <th className="w-8 px-2 py-2" />
            {COLUMNS.map(col => (
              <th
                key={col.key}
                onClick={() => SORTABLE.has(col.key) && onSortChange(col.key)}
                className={`text-left px-3 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wide ${SORTABLE.has(col.key) ? 'cursor-pointer hover:text-slate-700 select-none' : ''}`}
              >
                <span className="inline-flex items-center gap-1">
                  {col.label}
                  {sortBy === col.key && <ChevronUp size={11} />}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {!tasks.length ? (
            <tr><td colSpan={COLUMNS.length + 1} className="text-center text-sm text-slate-400 py-10">Tidak ada task di sini</td></tr>
          ) : tasks.map(task => {
            const due = fmtDue(task.dueDate)
            const done = task.status === 'DONE'
            const expanded = expandedIds.has(task.id)
            return (
              <Fragment key={task.id}>
                <tr onClick={() => onOpen(task)} className="border-b border-slate-100 hover:bg-slate-50/60 cursor-pointer transition-colors">
                  <td className="px-2 py-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleExpand(task.id) }}
                      title={expanded ? 'Tutup sub-task' : 'Lihat sub-task'}
                      className={`w-5 h-5 flex items-center justify-center text-slate-300 hover:text-slate-500 transition-transform ${expanded ? 'rotate-90' : ''}`}
                    >
                      <ChevronRight size={13} />
                    </button>
                  </td>
                  <td className="px-3 py-2">
                    <span className={`font-medium ${done ? 'text-slate-400 line-through' : 'text-slate-800'}`}>{task.title}</span>
                  </td>
                  <td className="px-3 py-2">
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${STATUS_CONFIG[task.status].cls}`}>{STATUS_CONFIG[task.status].label}</span>
                  </td>
                  <td className="px-3 py-2">
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${PRIORITY_CONFIG[task.priority].cls}`}>{PRIORITY_CONFIG[task.priority].label}</span>
                  </td>
                  <td className="px-3 py-2">
                    {Array.isArray(task.assignees) && task.assignees.length > 0 ? (
                      <span className="flex flex-wrap items-center gap-1.5">
                        {task.assignees.map(a => (
                          <span key={a.id} className="inline-flex items-center gap-1.5">
                            <span className={`w-5 h-5 rounded-full text-white text-[9px] font-bold flex items-center justify-center ${avatarColor(a.id)}`}>
                              {initials(a.name)}
                            </span>
                            <span className="text-slate-600 text-xs">{a.name}</span>
                          </span>
                        ))}
                      </span>
                    ) : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-3 py-2">
                    {due ? <span className={due.overdue ? 'text-danger font-medium' : 'text-slate-500'}>{due.text}</span> : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      {(task.tags ?? []).map(tag => (
                        <span key={tag} className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500">#{tag}</span>
                      ))}
                    </div>
                  </td>
                </tr>
                {expanded && (
                  <tr className="border-b border-slate-100 bg-slate-50/70">
                    <td colSpan={COLUMNS.length + 1} className="px-3 py-2">
                      <div className="pl-6">
                        <SubtaskTree parentId={task.id} onOpenTask={onOpen} />
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
