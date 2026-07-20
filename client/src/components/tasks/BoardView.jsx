import {
  DndContext, PointerSensor, useSensor, useSensors, useDraggable, useDroppable,
} from '@dnd-kit/core'
import { STATUS_CONFIG, BOARD_COLUMNS } from './taskConfig'
import TaskCard from './TaskCard'

function DraggableCard({ task, onOpen }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: String(task.id) })
  return (
    <div ref={setNodeRef}>
      <TaskCard task={task} onOpen={onOpen} dragHandleProps={{ ...attributes, ...listeners }} dragging={isDragging} />
    </div>
  )
}

function Column({ status, tasks, onOpen }) {
  const { setNodeRef, isOver } = useDroppable({ id: status })
  return (
    <div className="flex-1 min-w-[240px]">
      <div className="flex items-center gap-2 mb-2 px-0.5">
        <span className={`w-1.5 h-1.5 rounded-full ${STATUS_CONFIG[status].dot}`} />
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{STATUS_CONFIG[status].label}</p>
        <span className="text-xs text-slate-300">{tasks.length}</span>
      </div>
      <div
        ref={setNodeRef}
        className={`space-y-1.5 min-h-[120px] rounded-lg p-1.5 transition-colors ${isOver ? 'bg-slate-100' : ''}`}
      >
        {tasks.map(task => <DraggableCard key={task.id} task={task} onOpen={onOpen} />)}
      </div>
    </div>
  )
}

export default function BoardView({ tasks, onOpen, onStatusChange }) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  function handleDragEnd(e) {
    const { active, over } = e
    if (!over) return
    const newStatus = over.id
    const task = tasks.find(t => String(t.id) === active.id)
    if (task && task.status !== newStatus) onStatusChange(task.id, newStatus)
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-2">
        {BOARD_COLUMNS.map(status => (
          <Column key={status} status={status} tasks={tasks.filter(t => t.status === status)} onOpen={onOpen} />
        ))}
      </div>
    </DndContext>
  )
}
