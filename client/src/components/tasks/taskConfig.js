import { Sun, Star, ClipboardList, ListChecks, CheckCircle2, Globe } from 'lucide-react'

// Same semantic color tokens as the rest of the app (tailwind.config.js:
// success/warning/danger/info) instead of ad-hoc slate/blue/green — ties
// the task badges into the app's existing visual language.
export const STATUS_CONFIG = {
  TODO:        { label: 'To Do',       cls: 'bg-slate-100 text-slate-500 border border-slate-200', dot: 'bg-slate-400' },
  IN_PROGRESS: { label: 'In Progress', cls: 'bg-info-light text-info border border-info-border',   dot: 'bg-info' },
  DONE:        { label: 'Done',        cls: 'bg-success-light text-success border border-success-border', dot: 'bg-success' },
}

// Escalation ladder grey → amber → red reads as increasing urgency, unlike
// the previous grey → blue → red (blue doesn't sit between grey and red).
// `border` is spelled out as its own literal string (not derived from `bar`
// via string replace) so Tailwind's static class scanner can actually see
// and generate it — a computed `bar.replace('bg-','border-')` string never
// appears verbatim in source and would get purged from the production build.
export const PRIORITY_CONFIG = {
  LOW:    { label: 'Low',    cls: 'bg-slate-100 text-slate-500 border border-slate-200',       dot: 'bg-slate-300',  bar: 'bg-slate-300', border: 'border-slate-300' },
  MEDIUM: { label: 'Medium', cls: 'bg-warning-light text-warning border border-warning-border', dot: 'bg-warning',    bar: 'bg-warning',   border: 'border-warning' },
  HIGH:   { label: 'High',   cls: 'bg-danger-light text-danger border border-danger-border',    dot: 'bg-danger',     bar: 'bg-danger',    border: 'border-danger' },
}

export const BOARD_COLUMNS = ['TODO', 'IN_PROGRESS', 'DONE']

// Sidebar views — mirrors the "view" query param handled server-side in taskController.list.
export const SIDEBAR_VIEWS = [
  { id: 'my_day',    label: 'My Day',          icon: Sun,           empty: 'Belum ada task di My Day — tarik task ke sini lewat panel detail.' },
  { id: 'important', label: 'Important',       icon: Star,          empty: 'Belum ada task penting yang ditandai.' },
  { id: 'assigned',  label: 'Assigned to Me',  icon: ClipboardList, empty: 'Belum ada task yang ditugaskan ke kamu.' },
  { id: 'created',   label: 'My Tasks',        icon: ListChecks,    empty: 'Kamu belum membuat task apa pun.' },
  { id: 'completed', label: 'Completed',       icon: CheckCircle2,  empty: 'Belum ada task yang selesai.' },
]

export const ALL_TASKS_VIEW = { id: 'all', label: 'All Tasks', icon: Globe, empty: 'Belum ada task di perusahaan ini.' }

// Deterministic per-user accent so avatars stay visually distinct without
// being random on every render — cycles through the app's semantic palette
// (kept out of red/brand so assignee chips never get mistaken for the
// brand-colored "you" affordances elsewhere in the panel).
const AVATAR_HUES = [
  'bg-slate-700', 'bg-info', 'bg-success', 'bg-warning', 'bg-purple-600', 'bg-teal-600',
]
export function avatarColor(id) {
  const n = Number(id) || 0
  return AVATAR_HUES[n % AVATAR_HUES.length]
}

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
