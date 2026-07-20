import {
  DndContext, PointerSensor, useSensor, useSensors, useDraggable, useDroppable,
} from '@dnd-kit/core'
import { STATUS_CONFIG, BOARD_COLUMNS } from './taskConfig'
import TaskCard from './TaskCard'

function DraggableCard({ task, onOpen, onToggleDone }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: String(task.id) })
  return (
    <div ref={setNodeRef}>
      <TaskCard task={task} onOpen={onOpen} onToggleDone={onToggleDone} dragHandleProps={{ ...attributes, ...listeners }} dragging={isDragging} />
    </div>
  )
}

function Column({ status, tasks, onOpen, onToggleDone }) {
  const { setNodeRef, isOver } = useDroppable({ id: status })
  return (
    <div className="flex-1 min-w-[260px] bg-offwhite/50 border border-slate-100 rounded-xl p-2.5">
      <div className="flex items-center gap-2 mb-2.5 px-0.5">
        <span className={`w-1.5 h-1.5 rounded-full ${STATUS_CONFIG[status].dot}`} />
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{STATUS_CONFIG[status].label}</p>
        <span className="text-[10px] font-bold text-slate-400 bg-white px-1.5 rounded-full ml-auto">{tasks.length}</span>
      </div>
      <div
        ref={setNodeRef}
        className={`space-y-1.5 min-h-[140px] rounded-lg p-1 transition-colors duration-150 ${
          isOver ? 'bg-brand-50 ring-2 ring-brand-100 ring-inset' : ''
        }`}
      >
        {tasks.map(task => <DraggableCard key={task.id} task={task} onOpen={onOpen} onToggleDone={onToggleDone} />)}
        {!tasks.length && !isOver && (
          <p className="text-center text-xs text-slate-300 py-6">Kosong</p>
        )}
      </div>
    </div>
  )
}

export default function BoardView({ tasks, onOpen, onToggleDone, onStatusChange }) {
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
      <div className="flex gap-3 overflow-x-auto pb-2 -m-1 p-1">
        {BOARD_COLUMNS.map(status => (
          <Column key={status} status={status} tasks={tasks.filter(t => t.status === status)} onOpen={onOpen} onToggleDone={onToggleDone} />
        ))}
      </div>
    </DndContext>
  )
}
