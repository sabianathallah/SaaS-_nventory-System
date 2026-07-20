import { MessageSquare, Calendar, Star } from 'lucide-react'
import { PRIORITY_CONFIG, initials, fmtDue } from './taskConfig'

export default function TaskCard({ task, onOpen, dragHandleProps, dragging }) {
  const due = fmtDue(task.dueDate)
  return (
    <div
      onClick={() => onOpen(task)}
      {...dragHandleProps}
      className={`bg-white border border-slate-200 rounded-lg px-3 py-2.5 cursor-pointer hover:border-slate-300 hover:shadow-sm transition-all ${dragging ? 'opacity-50' : ''}`}
    >
      <div className="flex items-start gap-2">
        <span className={`mt-1 w-1.5 h-1.5 rounded-full flex-shrink-0 ${PRIORITY_CONFIG[task.priority].dot}`} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-800 truncate">{task.title}</p>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            {task.assignee && (
              <span className="w-5 h-5 rounded-full bg-slate-700 text-white text-[9px] font-bold flex items-center justify-center flex-shrink-0" title={task.assignee.name}>
                {initials(task.assignee.name)}
              </span>
            )}
            {due && (
              <span className={`inline-flex items-center gap-1 text-[11px] font-medium ${due.overdue ? 'text-red-500' : 'text-slate-400'}`}>
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
        {task.isImportant && <Star size={13} className="text-amber-400 fill-amber-400 flex-shrink-0" />}
      </div>
    </div>
  )
}
