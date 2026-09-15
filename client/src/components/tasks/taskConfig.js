import { Star, ClipboardList, ListChecks, CheckCircle2, Globe, LayoutDashboard, FolderKanban, BarChart2 } from 'lucide-react'

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

// Assignment response pill shown on cards/panel while a delegated task awaits
// (or was refused) the assignee's response — reuses the same semantic tokens
// as STATUS_CONFIG/PRIORITY_CONFIG rather than introducing new ad-hoc colors.
export const ASSIGNMENT_STATUS_CONFIG = {
  PENDING:  { label: 'Menunggu respon', cls: 'bg-warning-light text-warning border border-warning-border' },
  REJECTED: { label: 'Ditolak',         cls: 'bg-danger-light text-danger border border-danger-border' },
  ACCEPTED: { label: 'Diterima',        cls: 'bg-success-light text-success border border-success-border' },
}

export const RECURRENCE_CONFIG = {
  NONE:    { label: 'Tidak berulang', dot: 'bg-slate-300' },
  DAILY:   { label: 'Setiap hari',    dot: 'bg-info' },
  WEEKLY:  { label: 'Setiap minggu',  dot: 'bg-purple-500' },
  MONTHLY: { label: 'Setiap bulan',   dot: 'bg-teal-500' },
}

// Grouping order when List View is switched to "Kelompokkan: Pengulangan" —
// most-frequent first, non-repeating tasks last.
export const RECURRENCE_ORDER = ['DAILY', 'WEEKLY', 'MONTHLY', 'NONE']

export const BOARD_COLUMNS = ['TODO', 'IN_PROGRESS', 'DONE']

// Sidebar views — mirrors the "view" query param handled server-side in taskController.list.
// My Day pindah ke Dashboard utama (lihat components/tasks/MyDayToday.jsx) —
// modul Tugas ini murni untuk mengelola & meninjau seluruh task.
export const SIDEBAR_VIEWS = [
  { id: 'dashboard', label: 'Dashboard',       icon: LayoutDashboard },
  { id: 'important', label: 'Important',       icon: Star,          empty: 'Belum ada task penting yang ditandai.' },
  { id: 'assigned',  label: 'Assigned to Me',  icon: ClipboardList, empty: 'Belum ada task yang ditugaskan ke kamu.' },
  { id: 'created',   label: 'My Tasks',        icon: ListChecks,    empty: 'Kamu belum membuat task apa pun.' },
  { id: 'completed', label: 'Completed',       icon: CheckCircle2,  empty: 'Belum ada task yang selesai.' },
]

export const ALL_TASKS_VIEW = { id: 'all', label: 'All Tasks', icon: Globe, empty: 'Belum ada task di perusahaan ini.' }

// Landing page saat modul Tugas pertama dibuka — grid folder per divisi.
export const FOLDERS_VIEW = { id: 'folders', label: 'Folders', icon: FolderKanban }

// Admin/manager-only staff & divisi performance dashboard — only ever shown
// in the sidebar when TasksSidebar's `canSeeAll` check passes.
export const ANALYTICS_VIEW = { id: 'analytics', label: 'Analitik', icon: BarChart2 }

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

// Markdown-lite: bold/italic/inline-code/checklist-line/http(s)-only links.
// Escapes HTML first, then layers the allowlisted patterns on top — no raw
// HTML or javascript:/data: URI schemes ever make it through.
export function renderMarkdown(text) {
  if (!text) return ''
  const html = text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/_(.+?)_/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code style="background:#f1f5f9;padding:1px 4px;border-radius:3px;font-size:.9em">$1</code>')
    .replace(/^- \[ \] (.+)$/gm, '<span style="display:flex;gap:6px;align-items:baseline"><span style="opacity:.4">☐</span>$1</span>')
    .replace(/^- \[x\] (.+)$/gmi, '<span style="display:flex;gap:6px;align-items:baseline;opacity:.6"><span>☑</span><span style="text-decoration:line-through">$1</span></span>')
    .replace(/^- (.+)$/gm, '<li style="margin-left:16px;list-style:disc">$1</li>')
    .replace(/\[(.+?)\]\((.+?)\)/g, (_, label, url) =>
      /^https?:\/\//i.test(url)
        ? `<a href="${encodeURI(url)}" target="_blank" rel="noopener noreferrer" style="color:var(--brand);text-decoration:underline">${label}</a>`
        : label)
    .replace(/\n/g, '<br>')
  return html
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
