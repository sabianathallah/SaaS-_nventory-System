import { Sun, Star, ClipboardList, ListChecks, CheckCircle2, Globe } from 'lucide-react'

export const STATUS_CONFIG = {
  TODO:        { label: 'To Do',       cls: 'bg-slate-100 text-slate-600', dot: 'bg-slate-400' },
  IN_PROGRESS: { label: 'In Progress', cls: 'bg-blue-50 text-blue-600',    dot: 'bg-blue-500' },
  DONE:        { label: 'Done',        cls: 'bg-green-50 text-green-600', dot: 'bg-green-500' },
}

export const PRIORITY_CONFIG = {
  LOW:    { label: 'Low',    cls: 'bg-slate-100 text-slate-500', dot: 'bg-slate-300' },
  MEDIUM: { label: 'Medium', cls: 'bg-blue-50 text-blue-600',    dot: 'bg-blue-400' },
  HIGH:   { label: 'High',   cls: 'bg-red-50 text-red-600',      dot: 'bg-red-500' },
}

export const BOARD_COLUMNS = ['TODO', 'IN_PROGRESS', 'DONE']

// Sidebar views — mirrors the "view" query param handled server-side in taskController.list.
export const SIDEBAR_VIEWS = [
  { id: 'my_day',    label: 'My Day',          icon: Sun },
  { id: 'important', label: 'Important',       icon: Star },
  { id: 'assigned',  label: 'Assigned to Me',  icon: ClipboardList },
  { id: 'created',   label: 'My Tasks',        icon: ListChecks },
  { id: 'completed', label: 'Completed',       icon: CheckCircle2 },
]

export const ALL_TASKS_VIEW = { id: 'all', label: 'All Tasks', icon: Globe }

export function initials(name) {
  if (!name) return '?'
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
}

export function fmtDue(iso) {
  if (!iso) return null
  const d = new Date(`${iso}T00:00:00`)
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const diffDays = Math.round((d - now) / 86400000)
  const overdue = diffDays < 0
  let text
  if (diffDays === 0) text = 'Today'
  else if (diffDays === 1) text = 'Tomorrow'
  else text = d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })
  return { text, overdue }
}
