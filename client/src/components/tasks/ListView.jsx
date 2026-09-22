import { useState } from 'react'
import { ListChecks } from 'lucide-react'
import {
  DndContext, PointerSensor, useSensor, useSensors, useDraggable, useDroppable,
} from '@dnd-kit/core'
import { STATUS_CONFIG, RECURRENCE_CONFIG, RECURRENCE_ORDER, BOARD_COLUMNS, SIDEBAR_VIEWS, ALL_TASKS_VIEW } from './taskConfig'
import TaskCard from './TaskCard'
import SubtaskTree from './SubtaskTree'

const EMPTY_TEXT = Object.fromEntries([...SIDEBAR_VIEWS, ALL_TASKS_VIEW].map(v => [v.id, v.empty]))

// Grup "Tanpa project" pakai sentinel ini sebagai id droppable-nya — menyeret
// kartu ke situ berarti melepas task dari project-nya.
const NO_PROJECT = 'none'

// Dua pasang komponen (plain vs droppable/draggable) dipilih lewat flag
// `dragEnabled`, bukan hook kondisional di dalam satu komponen — dnd-kit hooks
// hanya sah di dalam DndContext, dan mengganti tipe komponen saat mode grup
// berubah membuat React me-remount alih-alih melanggar urutan hook.
function PlainGroup({ children }) {
  return <div className="space-y-1.5">{children}</div>
}

function DroppableGroup({ groupKey, children }) {
  const { setNodeRef, isOver } = useDroppable({ id: `project:${groupKey}` })
  return (
    <div
      ref={setNodeRef}
      className={`space-y-1.5 rounded-lg p-1 -m-1 min-h-[52px] transition-colors duration-150 ${
        isOver ? 'bg-brand-50 ring-2 ring-brand-100 ring-inset' : ''
      }`}
    >
      {children}
    </div>
  )
}

function PlainRow({ children }) {
  return children
}

function DraggableRow({ task, render }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: String(task.id) })
  return <div ref={setNodeRef}>{render({ ...attributes, ...listeners }, isDragging)}</div>
}

export default function ListView({ tasks, view, groupBy = 'status', onOpen, onToggleDone, onProjectChange }) {
  const [expandedIds, setExpandedIds] = useState(new Set())
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  // Memindahkan task antar project hanya masuk akal saat grupnya memang
  // project — di grup Status/Pengulangan, Board View yang menangani drag.
  const dragEnabled = groupBy === 'project' && typeof onProjectChange === 'function'

  function toggleExpand(id) {
    setExpandedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function handleDragEnd(e) {
    const { active, over } = e
    if (!over) return
    const targetKey = String(over.id).replace(/^project:/, '')
    const task = tasks.find(t => String(t.id) === active.id)
    if (!task) return
    const currentKey = task.project?.id ? String(task.project.id) : NO_PROJECT
    if (currentKey === targetKey) return
    onProjectChange(task, targetKey === NO_PROJECT ? null : Number(targetKey))
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

  // Grouping by project keys off the project actually attached to each task
  // (not a fetched project list) so a view can only ever show the projects
  // it really contains — tasks without one collect in "Tanpa project", always
  // last so the named projects read first.
  const projectGroups = () => {
    const byId = new Map()
    // Grup "Tanpa project" selalu ada saat mode drag aktif, supaya selalu ada
    // tempat untuk menjatuhkan kartu yang mau dilepas dari project-nya.
    if (dragEnabled) byId.set(NO_PROJECT, { key: NO_PROJECT, label: 'Tanpa project', color: null, tasks: [] })
    for (const t of tasks) {
      const key = t.project?.id ? String(t.project.id) : NO_PROJECT
      if (!byId.has(key)) {
        byId.set(key, {
          key,
          label: t.project?.name ?? 'Tanpa project',
          color: t.project?.color ?? null,
          tasks: [],
        })
      }
      byId.get(key).tasks.push(t)
    }
    const groups = [...byId.values()]
    groups.sort((a, b) => (a.key === NO_PROJECT) - (b.key === NO_PROJECT) || a.label.localeCompare(b.label))
    return groups
  }

  const groups = groupBy === 'project'
    ? projectGroups()
    : groupBy === 'recurrence'
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

  const Group = dragEnabled ? DroppableGroup : PlainGroup
  let cardIndex = 0

  const body = (
    <div className="space-y-6">
      {groups.map(({ key, label, dot, color, tasks: groupTasks }) => (
        <div key={key}>
          <div className="flex items-center gap-2 mb-2">
            <span
              className={`w-1.5 h-1.5 rounded-full ${color ? '' : dot ?? 'bg-slate-300'}`}
              style={color ? { background: color } : undefined}
            />
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{label}</p>
            <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 rounded-full">{groupTasks.length}</span>
          </div>
          <Group groupKey={key}>
            {groupTasks.map(task => {
              const delay = Math.min(cardIndex++, 8) * 25
              const expanded = expandedIds.has(task.id)
              const renderCard = (dragHandleProps, dragging) => (
                <div className="animate-slide-up" style={{ animationDelay: `${delay}ms`, animationFillMode: 'backwards' }}>
                  <TaskCard
                    task={task}
                    onOpen={onOpen}
                    onToggleDone={onToggleDone}
                    expandable
                    expanded={expanded}
                    onToggleExpand={toggleExpand}
                    dragHandleProps={dragHandleProps}
                    dragging={dragging}
                  />
                  {expanded && (
                    <div className="ml-6 mt-1 mb-1.5 px-3 py-2 bg-slate-50/70 border border-slate-200 rounded-lg">
                      <SubtaskTree parentId={task.id} onOpenTask={onOpen} />
                    </div>
                  )}
                </div>
              )
              return dragEnabled
                ? <DraggableRow key={task.id} task={task} render={renderCard} />
                : <PlainRow key={task.id}>{renderCard(undefined, false)}</PlainRow>
            })}
            {dragEnabled && !groupTasks.length && (
              <p className="text-center text-xs text-slate-300 py-3">Seret task ke sini</p>
            )}
          </Group>
        </div>
      ))}
    </div>
  )

  return dragEnabled
    ? <DndContext sensors={sensors} onDragEnd={handleDragEnd}>{body}</DndContext>
    : body
}
