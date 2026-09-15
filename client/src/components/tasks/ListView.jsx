import { useState } from 'react'
import { ListChecks } from 'lucide-react'
import { STATUS_CONFIG, RECURRENCE_CONFIG, RECURRENCE_ORDER, BOARD_COLUMNS, SIDEBAR_VIEWS, ALL_TASKS_VIEW } from './taskConfig'
import TaskCard from './TaskCard'
import SubtaskTree from './SubtaskTree'

const EMPTY_TEXT = Object.fromEntries([...SIDEBAR_VIEWS, ALL_TASKS_VIEW].map(v => [v.id, v.empty]))

export default function ListView({ tasks, view, groupBy = 'status', onOpen, onToggleDone }) {
  const [expandedIds, setExpandedIds] = useState(new Set())

  function toggleExpand(id) {
    setExpandedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

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

  const groups = groupBy === 'recurrence'
    ? RECURRENCE_ORDER.map(key => ({
        key,
        label: RECURRENCE_CONFIG[key].label,
        dot: RECURRENCE_CONFIG[key].dot,
        tasks: tasks.filter(t => (t.recurrence || 'NONE') === key),
      })).filter(g => g.tasks.length > 0)
    : BOARD_COLUMNS.map(status => ({
        key: status,
        label: STATUS_CONFIG[status].label,
        dot: STATUS_CONFIG[status].dot,
        tasks: tasks.filter(t => t.status === status),
      })).filter(g => g.tasks.length > 0)

  let cardIndex = 0

  return (
    <div className="space-y-6">
      {groups.map(({ key, label, dot, tasks: groupTasks }) => (
        <div key={key}>
          <div className="flex items-center gap-2 mb-2">
            <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{label}</p>
            <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 rounded-full">{groupTasks.length}</span>
          </div>
          <div className="space-y-1.5">
            {groupTasks.map(task => {
              const delay = Math.min(cardIndex++, 8) * 25
              const expanded = expandedIds.has(task.id)
              return (
                <div key={task.id} className="animate-slide-up" style={{ animationDelay: `${delay}ms`, animationFillMode: 'backwards' }}>
                  <TaskCard
                    task={task}
                    onOpen={onOpen}
                    onToggleDone={onToggleDone}
                    expandable
                    expanded={expanded}
                    onToggleExpand={toggleExpand}
                  />
                  {expanded && (
                    <div className="ml-6 mt-1 mb-1.5 px-3 py-2 bg-slate-50/70 border border-slate-200 rounded-lg">
                      <SubtaskTree parentId={task.id} onOpenTask={onOpen} />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
