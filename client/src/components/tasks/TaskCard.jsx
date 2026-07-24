import { MessageSquare, Calendar, Star, Check, ListTree } from 'lucide-react'
import { PRIORITY_CONFIG, ASSIGNMENT_STATUS_CONFIG, avatarColor, initials, fmtDue } from './taskConfig'

export default function TaskCard({ task, onOpen, onToggleDone, dragHandleProps, dragging }) {
  const due = fmtDue(task.dueDate)
  const done = task.status === 'DONE'
  // A card shows the most urgent response state across all assignees —
  // any rejection outranks a pending response, both outrank "all accepted".
  const statuses = (task.assignees ?? []).map(a => a.TaskAssignee?.assignmentStatus).filter(Boolean)
  const worstAssignmentStatus = statuses.includes('REJECTED') ? 'REJECTED' : statuses.includes('PENDING') ? 'PENDING' : null

  return (
    <div
      {...dragHandleProps}
      onClick={() => onOpen(task)}
      className={`group relative flex items-start gap-2.5 bg-white border border-slate-200 rounded-lg pl-3 pr-3 py-2.5 cursor-pointer
        transition-all duration-150 hover:border-slate-300 hover:shadow-card-md hover:-translate-y-[1px]
        ${dragging ? 'opacity-40 rotate-1 shadow-card-md' : ''}`}
    >
      {/* Priority accent bar */}
      <span className={`absolute left-0 top-2 bottom-2 w-[3px] rounded-full ${PRIORITY_CONFIG[task.priority].bar}`} />

      {/* Quick-complete toggle */}
      <button
        onClick={(e) => { e.stopPropagation(); onToggleDone?.(task) }}
        title={done ? 'Tandai belum selesai' : 'Tandai selesai'}
        className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
          done ? 'bg-success border-success' : 'border-slate-300 hover:border-success'
        }`}
      >
        {done && <Check size={10} className="text-white" strokeWidth={3.5} />}
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          {task.list && <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: task.list.color }} title={task.list.name} />}
          <p className={`text-sm font-semibold truncate ${done ? 'text-slate-400 line-through' : 'text-slate-800'}`}>{task.title}</p>
        </div>
        {Array.isArray(task.tags) && task.tags.length > 0 && (
          <div className="flex items-center gap-1 mt-1 flex-wrap">
            {task.tags.map(tag => (
              <span key={tag} className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500">#{tag}</span>
            ))}
          </div>
        )}
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          {Array.isArray(task.assignees) && task.assignees.length > 0 && (
            <span className="flex items-center -space-x-1.5">
              {task.assignees.slice(0, 3).map(a => (
                <span
                  key={a.id}
                  className={`w-5 h-5 rounded-full text-white text-[9px] font-bold flex items-center justify-center flex-shrink-0 ring-2 ring-white ${avatarColor(a.id)}`}
                  title={a.name}
                >
                  {initials(a.name)}
                </span>
              ))}
              {task.assignees.length > 3 && (
                <span className="w-5 h-5 rounded-full bg-slate-300 text-white text-[8px] font-bold flex items-center justify-center flex-shrink-0 ring-2 ring-white">
                  +{task.assignees.length - 3}
                </span>
              )}
            </span>
          )}
          {due && (
            <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded-full ${
              due.overdue ? 'bg-danger-light text-danger' : 'text-slate-400'
            }`}>
              <Calendar size={10} />{due.text}
            </span>
          )}
          {Number(task.commentCount) > 0 && (
            <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
              <MessageSquare size={10} />{task.commentCount}
            </span>
          )}
          {Number(task.subTaskCount) > 0 && (
            <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
              <ListTree size={10} />{task.subTaskCount}
            </span>
          )}
          {worstAssignmentStatus && (
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${ASSIGNMENT_STATUS_CONFIG[worstAssignmentStatus].cls}`}>
              {ASSIGNMENT_STATUS_CONFIG[worstAssignmentStatus].label}
            </span>
          )}
        </div>
      </div>

      {task.isImportant && <Star size={13} className="text-warning fill-warning flex-shrink-0 mt-0.5" />}
    </div>
  )
}
