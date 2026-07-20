import { ChevronUp } from 'lucide-react'
import { STATUS_CONFIG, PRIORITY_CONFIG, avatarColor, initials, fmtDue } from './taskConfig'

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
  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200">
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
            <tr><td colSpan={COLUMNS.length} className="text-center text-sm text-slate-400 py-10">Tidak ada task di sini</td></tr>
          ) : tasks.map(task => {
            const due = fmtDue(task.dueDate)
            const done = task.status === 'DONE'
            return (
              <tr key={task.id} onClick={() => onOpen(task)} className="border-b border-slate-100 hover:bg-slate-50/60 cursor-pointer transition-colors">
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
                  {task.assignee ? (
                    <span className="inline-flex items-center gap-1.5">
                      <span className={`w-5 h-5 rounded-full text-white text-[9px] font-bold flex items-center justify-center ${avatarColor(task.assigneeId)}`}>
                        {initials(task.assignee.name)}
                      </span>
                      <span className="text-slate-600 text-xs">{task.assignee.name}</span>
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
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
