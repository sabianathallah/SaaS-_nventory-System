import { STATUS_CONFIG, BOARD_COLUMNS } from './taskConfig'
import TaskCard from './TaskCard'

export default function ListView({ tasks, onOpen }) {
  if (!tasks.length) {
    return <p className="text-sm text-slate-400 text-center py-16">Tidak ada task di sini</p>
  }

  const groups = BOARD_COLUMNS.map(status => ({
    status,
    tasks: tasks.filter(t => t.status === status),
  })).filter(g => g.tasks.length > 0)

  return (
    <div className="space-y-6">
      {groups.map(({ status, tasks: groupTasks }) => (
        <div key={status}>
          <div className="flex items-center gap-2 mb-2">
            <span className={`w-1.5 h-1.5 rounded-full ${STATUS_CONFIG[status].dot}`} />
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{STATUS_CONFIG[status].label}</p>
            <span className="text-xs text-slate-300">{groupTasks.length}</span>
          </div>
          <div className="space-y-1.5">
            {groupTasks.map(task => (
              <TaskCard key={task.id} task={task} onOpen={onOpen} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
