import { MessageSquare, Calendar, Star, Check } from 'lucide-react'
import { PRIORITY_CONFIG, avatarColor, initials, fmtDue } from './taskConfig'

export default function TaskCard({ task, onOpen, onToggleDone, dragHandleProps, dragging }) {
  const due = fmtDue(task.dueDate)
  const done = task.status === 'DONE'

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
        <p className={`text-sm font-semibold truncate ${done ? 'text-slate-400 line-through' : 'text-slate-800'}`}>{task.title}</p>
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          {task.assignee && (
            <span
              className={`w-5 h-5 rounded-full text-white text-[9px] font-bold flex items-center justify-center flex-shrink-0 ring-2 ring-white ${avatarColor(task.assigneeId)}`}
              title={task.assignee.name}
            >
              {initials(task.assignee.name)}
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
        </div>
      </div>

      {task.isImportant && <Star size={13} className="text-warning fill-warning flex-shrink-0 mt-0.5" />}
    </div>
  )
}
