import { useState } from 'react'
import {
  DndContext, PointerSensor, useSensor, useSensors, useDraggable, useDroppable,
} from '@dnd-kit/core'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { PRIORITY_CONFIG } from './taskConfig'

const WEEKDAYS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']

function toISODate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function buildGrid(year, month) {
  const first = new Date(year, month, 1)
  const start = new Date(first)
  start.setDate(first.getDate() - first.getDay())
  const days = []
  for (let i = 0; i < 42; i++) {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    days.push(d)
  }
  return days
}

function DraggableChip({ task, onOpen }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: String(task.id) })
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={() => onOpen(task)}
      className={`flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-white border border-slate-200 cursor-pointer truncate hover:border-slate-300 transition-all ${isDragging ? 'opacity-40' : ''}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${PRIORITY_CONFIG[task.priority].dot}`} />
      <span className="truncate">{task.title}</span>
    </div>
  )
}

function DayCell({ date, isCurrentMonth, isToday, tasks, onOpen }) {
  const iso = toISODate(date)
  const { setNodeRef, isOver } = useDroppable({ id: iso })
  return (
    <div
      ref={setNodeRef}
      className={`min-h-[92px] border border-slate-100 p-1.5 flex flex-col gap-1 transition-colors ${
        isOver ? 'bg-brand-50 ring-2 ring-brand-100 ring-inset' : isCurrentMonth ? 'bg-white' : 'bg-slate-50/60'
      }`}
    >
      <span className={`text-[11px] font-semibold w-5 h-5 rounded-full flex items-center justify-center ${
        isToday ? 'text-white' : isCurrentMonth ? 'text-slate-600' : 'text-slate-300'
      }`} style={isToday ? { background: 'var(--brand)' } : undefined}>
        {date.getDate()}
      </span>
      <div className="space-y-1 overflow-y-auto">
        {tasks.map(task => <DraggableChip key={task.id} task={task} onOpen={onOpen} />)}
      </div>
    </div>
  )
}

export default function CalendarView({ tasks, onOpen, onReschedule }) {
  const [cursor, setCursor] = useState(() => {
    const now = new Date()
    return { year: now.getFullYear(), month: now.getMonth() }
  })
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))
  const todayISO = toISODate(new Date())

  const days = buildGrid(cursor.year, cursor.month)
  const byDate = {}
  tasks.forEach(t => {
    if (!t.dueDate) return
    const key = t.dueDate.slice(0, 10)
    ;(byDate[key] ??= []).push(t)
  })

  function handleDragEnd(e) {
    const { active, over } = e
    if (!over) return
    const task = tasks.find(t => String(t.id) === active.id)
    if (task && task.dueDate?.slice(0, 10) !== over.id) onReschedule(task.id, over.id)
  }

  function shiftMonth(delta) {
    setCursor(c => {
      const d = new Date(c.year, c.month + delta, 1)
      return { year: d.getFullYear(), month: d.getMonth() }
    })
  }

  const monthLabel = new Date(cursor.year, cursor.month, 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
  const withoutDueDate = tasks.filter(t => !t.dueDate).length

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-slate-700">{monthLabel}</p>
        <div className="flex items-center gap-1">
          <button onClick={() => shiftMonth(-1)} className="w-7 h-7 rounded-md flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"><ChevronLeft size={15} /></button>
          <button onClick={() => shiftMonth(1)} className="w-7 h-7 rounded-md flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"><ChevronRight size={15} /></button>
        </div>
      </div>

      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-7 rounded-lg overflow-hidden border border-slate-100">
          {WEEKDAYS.map(w => (
            <div key={w} className="bg-slate-50 text-center text-[10px] font-semibold text-slate-400 uppercase tracking-wider py-1.5">{w}</div>
          ))}
          {days.map(date => {
            const iso = toISODate(date)
            return (
              <DayCell
                key={iso}
                date={date}
                isCurrentMonth={date.getMonth() === cursor.month}
                isToday={iso === todayISO}
                tasks={byDate[iso] || []}
                onOpen={onOpen}
              />
            )
          })}
        </div>
      </DndContext>

      {withoutDueDate > 0 && (
        <p className="text-xs text-slate-400 mt-2">{withoutDueDate} task tanpa due date tidak ditampilkan di kalender.</p>
      )}
    </div>
  )
}
