import { ListChecks } from 'lucide-react'
import { STATUS_CONFIG, BOARD_COLUMNS, SIDEBAR_VIEWS, ALL_TASKS_VIEW } from './taskConfig'
import TaskCard from './TaskCard'

const EMPTY_TEXT = Object.fromEntries([...SIDEBAR_VIEWS, ALL_TASKS_VIEW].map(v => [v.id, v.empty]))

export default function ListView({ tasks, view, onOpen, onToggleDone }) {
  if (!tasks.length) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-11 h-11 rounded-full bg-slate-100 flex items-center justify-center mb-3">
          <ListChecks size={18} className="text-slate-300" />
        </div>
        <p className="text-sm text-slate-400 max-w-xs">{EMPTY_TEXT[view] ?? 'Tidak ada task di sini'}</p>
      </div>
    )
  }

  const groups = BOARD_COLUMNS.map(status => ({
    status,
    tasks: tasks.filter(t => t.status === status),
  })).filter(g => g.tasks.length > 0)

  let cardIndex = 0

  return (
    <div className="space-y-6">
      {groups.map(({ status, tasks: groupTasks }) => (
        <div key={status}>
          <div className="flex items-center gap-2 mb-2">
            <span className={`w-1.5 h-1.5 rounded-full ${STATUS_CONFIG[status].dot}`} />
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{STATUS_CONFIG[status].label}</p>
            <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 rounded-full">{groupTasks.length}</span>
          </div>
          <div className="space-y-1.5">
            {groupTasks.map(task => {
              const delay = Math.min(cardIndex++, 8) * 25
              return (
                <div key={task.id} className="animate-slide-up" style={{ animationDelay: `${delay}ms`, animationFillMode: 'backwards' }}>
                  <TaskCard task={task} onOpen={onOpen} onToggleDone={onToggleDone} />
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
