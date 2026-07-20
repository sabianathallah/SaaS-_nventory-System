import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { tasksApi, usersApi } from '../api'
import { useAuth } from '../context/AuthContext'
import PageHeader from '../components/PageHeader'
import SearchBar from '../components/SearchBar'
import toast from 'react-hot-toast'
import { Plus, LayoutList, Columns3 } from 'lucide-react'
import TasksSidebar from '../components/tasks/TasksSidebar'
import ListView from '../components/tasks/ListView'
import BoardView from '../components/tasks/BoardView'
import TaskDetailPanel from '../components/tasks/TaskDetailPanel'
import CreateTaskModal from '../components/tasks/CreateTaskModal'
import { SIDEBAR_VIEWS, ALL_TASKS_VIEW } from '../components/tasks/taskConfig'

const VIEW_LABELS = Object.fromEntries([...SIDEBAR_VIEWS, ALL_TASKS_VIEW].map(v => [v.id, v.label]))

export default function Tasks() {
  const qc = useQueryClient()
  const { user, hasPermission, isSuperAdmin, isAdmin } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()

  const [sidebarView, setSidebarView] = useState('my_day')
  const [viewMode, setViewMode] = useState('list')
  const [search, setSearch] = useState('')
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

  const { data, isLoading } = useQuery({
    queryKey: ['tasks', { view: sidebarView }],
    queryFn: () => tasksApi.list({ view: sidebarView, limit: 200 }),
  })
  const tasks = data?.data ?? []

  const filteredTasks = useMemo(() => {
    const list = data?.data ?? []
    if (!search.trim()) return list
    const q = search.trim().toLowerCase()
    return list.filter(t => t.title.toLowerCase().includes(q))
  }, [data, search])

  const { data: usersRes } = useQuery({
    queryKey: ['users', 'for-tasks'],
    queryFn: () => usersApi.list({ limit: 500 }),
  })
  const userOptions = usersRes?.data ?? []

  const selectedTask = tasks.find(t => t.id === selectedId) || null

  const quickStatus = useMutation({
    mutationFn: ({ id, status }) => tasksApi.update(id, { status }),
    onMutate: async ({ id, status }) => {
      const key = ['tasks', { view: sidebarView }]
      await qc.cancelQueries({ queryKey: key })
      const prev = qc.getQueryData(key)
      qc.setQueryData(key, (old) => old && {
        ...old,
        data: old.data.map(t => t.id === id ? { ...t, status } : t),
      })
      return { prev }
    },
    onError: (e, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(['tasks', { view: sidebarView }], ctx.prev)
      toast.error(e.response?.data?.message || 'Error')
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  })

  const canDeleteSelected = !!selectedTask && (
    isSuperAdmin || isAdmin || hasPermission('tasks.delete') || hasPermission('tasks.manage') || selectedTask.createdBy === user?.id
  )

  function toggleDone(task) {
    quickStatus.mutate({ id: task.id, status: task.status === 'DONE' ? 'TODO' : 'DONE' })
  }

  return (
    <div className="px-6 py-6">
      <PageHeader
        title="Tugas"
        subtitle={`${filteredTasks.length} task — ${VIEW_LABELS[sidebarView] ?? ''}`}
        action={
          <button onClick={() => setShowCreate(true)} className="btn-primary">
            <Plus size={14} />Task Baru
          </button>
        }
      />

      <div className="card overflow-hidden flex" style={{ minHeight: 500 }}>
        <TasksSidebar active={sidebarView} onSelect={(v) => { setSidebarView(v); setSelectedId(null) }} />

        <div className="flex-1 min-w-0 flex flex-col">
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
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {isLoading ? (
              <p className="text-sm text-slate-400 text-center py-16">Memuat…</p>
            ) : viewMode === 'list' ? (
              <ListView tasks={filteredTasks} view={sidebarView} onOpen={(t) => setSelectedId(t.id)} onToggleDone={toggleDone} />
            ) : (
              <BoardView
                tasks={filteredTasks}
                onOpen={(t) => setSelectedId(t.id)}
                onToggleDone={toggleDone}
                onStatusChange={(id, status) => quickStatus.mutate({ id, status })}
              />
            )}
          </div>
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
