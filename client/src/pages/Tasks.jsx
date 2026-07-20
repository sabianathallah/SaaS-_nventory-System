import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { tasksApi, taskListsApi, usersApi } from '../api'
import { useAuth } from '../context/AuthContext'
import PageHeader from '../components/PageHeader'
import SearchBar from '../components/SearchBar'
import toast from 'react-hot-toast'
import { exportExcel } from '../utils/exportExcel'
import { Plus, LayoutList, Columns3, CalendarDays, Table2, FileSpreadsheet } from 'lucide-react'
import TasksSidebar from '../components/tasks/TasksSidebar'
import ListView from '../components/tasks/ListView'
import BoardView from '../components/tasks/BoardView'
import CalendarView from '../components/tasks/CalendarView'
import TableView from '../components/tasks/TableView'
import TaskDashboard from '../components/tasks/TaskDashboard'
import TaskDetailPanel from '../components/tasks/TaskDetailPanel'
import CreateTaskModal from '../components/tasks/CreateTaskModal'
import { SIDEBAR_VIEWS, ALL_TASKS_VIEW, STATUS_CONFIG, PRIORITY_CONFIG } from '../components/tasks/taskConfig'

const VIEW_LABELS = Object.fromEntries([...SIDEBAR_VIEWS, ALL_TASKS_VIEW].map(v => [v.id, v.label]))

const GREETINGS = ['Selamat pagi', 'Selamat siang', 'Selamat sore', 'Selamat malam']
function greeting() {
  const h = new Date().getHours()
  if (h < 11) return GREETINGS[0]
  if (h < 15) return GREETINGS[1]
  if (h < 19) return GREETINGS[2]
  return GREETINGS[3]
}

export default function Tasks() {
  const qc = useQueryClient()
  const { user, hasPermission, isSuperAdmin, isAdmin } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()

  const [sidebarView, setSidebarView] = useState('my_day')
  const [viewMode, setViewMode] = useState('list')
  const [search, setSearch] = useState('')
  const [activeTag, setActiveTag] = useState('')
  const [sortBy, setSortBy] = useState('created')
  const [showCreate, setShowCreate] = useState(false)
  const [selectedId, setSelectedId] = useState(null)

  // Deep-link from notification bell: /tasks?open=<id> — consumed once during
  // render (not an effect) so it doesn't cascade an extra render; guarded by
  // `consumedOpenId` so it only fires the first time a given id shows up.
  const [consumedOpenId, setConsumedOpenId] = useState(null)
  const openParam = searchParams.get('open')
  if (openParam && openParam !== consumedOpenId) {
    setConsumedOpenId(openParam)
    setSelectedId(Number(openParam))
  }

  // "Lists" are a separate filter dimension from the fixed sidebar views —
  // encoded as `list:<id>` (same convention San-Group used) rather than a
  // second piece of state, so there's still exactly one "active nav item".
  const activeListId = sidebarView.startsWith('list:') ? sidebarView.slice(5) : null
  const queryParams = activeListId
    ? { listId: activeListId, sortBy, limit: 200 }
    : { view: sidebarView, sortBy, limit: 200 }

  const isDashboard = sidebarView === 'dashboard'

  const { data, isLoading } = useQuery({
    queryKey: ['tasks', queryParams],
    queryFn: () => tasksApi.list(queryParams),
    enabled: !isDashboard,
  })
  const tasks = data?.data ?? []

  const availableTags = useMemo(() => {
    const set = new Set()
    for (const t of (data?.data ?? [])) for (const tag of (t.tags ?? [])) set.add(tag)
    return [...set].sort()
  }, [data])

  const filteredTasks = useMemo(() => {
    let list = data?.data ?? []
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(t => t.title.toLowerCase().includes(q))
    }
    if (activeTag) list = list.filter(t => (t.tags ?? []).includes(activeTag))
    return list
  }, [data, search, activeTag])

  const { data: usersRes } = useQuery({
    queryKey: ['users', 'for-tasks'],
    queryFn: () => usersApi.list({ limit: 500 }),
  })
  const userOptions = usersRes?.data ?? []

  const { data: listsRes } = useQuery({ queryKey: ['task-lists'], queryFn: taskListsApi.list })
  const activeList = activeListId ? (listsRes ?? []).find(l => String(l.id) === activeListId) : null

  const selectedTask = tasks.find(t => t.id === selectedId) || null

  // Generic optimistic single-field patch — used by Board's status-drag and
  // Calendar's date-drag alike, so both reuse the same cancel/rollback dance.
  const quickPatch = useMutation({
    mutationFn: ({ id, patch }) => tasksApi.update(id, patch),
    onMutate: async ({ id, patch }) => {
      const key = ['tasks', queryParams]
      await qc.cancelQueries({ queryKey: key })
      const prev = qc.getQueryData(key)
      qc.setQueryData(key, (old) => old && {
        ...old,
        data: old.data.map(t => t.id === id ? { ...t, ...patch } : t),
      })
      return { prev }
    },
    onError: (e, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(['tasks', queryParams], ctx.prev)
      toast.error(e.response?.data?.message || 'Error')
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  })

  const canDeleteSelected = !!selectedTask && (
    isSuperAdmin || isAdmin || hasPermission('tasks.delete') || hasPermission('tasks.manage') || selectedTask.createdBy === user?.id
  )

  function toggleDone(task) {
    quickPatch.mutate({ id: task.id, patch: { status: task.status === 'DONE' ? 'TODO' : 'DONE' } })
  }

  function handleExport() {
    const headers = ['Judul', 'Status', 'Priority', 'Assignee', 'Due Date', 'Dibuat oleh']
    const rows = filteredTasks.map(t => [
      t.title,
      STATUS_CONFIG[t.status]?.label ?? t.status,
      PRIORITY_CONFIG[t.priority]?.label ?? t.priority,
      t.assignee?.name || '—',
      t.dueDate || '—',
      t.creator?.name || '—',
    ])
    const viewLabel = activeList?.name ?? VIEW_LABELS[sidebarView] ?? sidebarView
    exportExcel(`tasks-${viewLabel}-${new Date().toISOString().slice(0, 10)}`, {
      headers, rows, sheetName: 'Tasks',
    })
  }

  const viewLabel = activeList?.name ?? VIEW_LABELS[sidebarView] ?? ''

  return (
    <div className="px-6 py-6">
      <PageHeader
        title="Tugas"
        subtitle={isDashboard ? 'Ringkasan seluruh task' : `${filteredTasks.length} task — ${viewLabel}`}
        action={
          <div className="flex items-center gap-2">
            {!isDashboard && (
              <button onClick={handleExport} className="btn-secondary" title="Export ke Excel">
                <FileSpreadsheet size={14} />Export
              </button>
            )}
            <button onClick={() => setShowCreate(true)} className="btn-primary">
              <Plus size={14} />Task Baru
            </button>
          </div>
        }
      />

      <div className="card overflow-hidden flex" style={{ minHeight: 500 }}>
        <TasksSidebar active={sidebarView} onSelect={(v) => { setSidebarView(v); setSelectedId(null) }} />

        <div className="flex-1 min-w-0 flex flex-col">
          {isDashboard ? (
            <div className="flex-1 overflow-y-auto">
              <TaskDashboard />
            </div>
          ) : (
          <>
          {sidebarView === 'my_day' && (
            <div className="px-4 pt-4 pb-1">
              <p className="text-lg font-bold text-slate-800">{greeting()}</p>
              <p className="text-xs text-slate-400">{new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
            </div>
          )}

          <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
            <SearchBar value={search} onChange={setSearch} placeholder="Cari task…" />
            <div className="ml-auto flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-0.5">
              <button
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-md transition-colors ${viewMode === 'list' ? 'nav-active' : 'text-slate-400 hover:text-slate-600'}`}
                title="List view"
              >
                <LayoutList size={14} />
              </button>
              <button
                onClick={() => setViewMode('board')}
                className={`p-1.5 rounded-md transition-colors ${viewMode === 'board' ? 'nav-active' : 'text-slate-400 hover:text-slate-600'}`}
                title="Board view"
              >
                <Columns3 size={14} />
              </button>
              <button
                onClick={() => setViewMode('calendar')}
                className={`p-1.5 rounded-md transition-colors ${viewMode === 'calendar' ? 'nav-active' : 'text-slate-400 hover:text-slate-600'}`}
                title="Calendar view"
              >
                <CalendarDays size={14} />
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-md transition-colors ${viewMode === 'table' ? 'nav-active' : 'text-slate-400 hover:text-slate-600'}`}
                title="Table view"
              >
                <Table2 size={14} />
              </button>
            </div>
          </div>

          {availableTags.length > 0 && (
            <div className="px-4 py-2 border-b border-slate-100 flex items-center gap-1.5 flex-wrap">
              {availableTags.map(tag => (
                <button
                  key={tag}
                  onClick={() => setActiveTag(t => t === tag ? '' : tag)}
                  className={`text-[11px] font-medium px-2 py-0.5 rounded-full transition-colors ${
                    activeTag === tag ? 'nav-active' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                  }`}
                >
                  #{tag}
                </button>
              ))}
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-4">
            {isLoading ? (
              <p className="text-sm text-slate-400 text-center py-16">Memuat…</p>
            ) : viewMode === 'list' ? (
              <ListView tasks={filteredTasks} view={sidebarView} onOpen={(t) => setSelectedId(t.id)} onToggleDone={toggleDone} />
            ) : viewMode === 'board' ? (
              <BoardView
                tasks={filteredTasks}
                onOpen={(t) => setSelectedId(t.id)}
                onToggleDone={toggleDone}
                onStatusChange={(id, status) => quickPatch.mutate({ id, patch: { status } })}
              />
            ) : viewMode === 'calendar' ? (
              <CalendarView
                tasks={filteredTasks}
                onOpen={(t) => setSelectedId(t.id)}
                onReschedule={(id, dueDate) => quickPatch.mutate({ id, patch: { dueDate } })}
              />
            ) : (
              <TableView
                tasks={filteredTasks}
                sortBy={sortBy}
                onSortChange={setSortBy}
                onOpen={(t) => setSelectedId(t.id)}
              />
            )}
          </div>
          </>
          )}
        </div>
      </div>

      <TaskDetailPanel
        task={selectedTask}
        userOptions={userOptions}
        onClose={() => {
          setSelectedId(null)
          if (searchParams.get('open')) setSearchParams(prev => { prev.delete('open'); return prev }, { replace: true })
        }}
        canDelete={canDeleteSelected}
      />

      <CreateTaskModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        userOptions={userOptions}
        defaultView={sidebarView}
      />
    </div>
  )
}
