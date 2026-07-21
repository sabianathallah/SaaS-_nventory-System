import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Plus, Sun, PartyPopper } from 'lucide-react'
import { tasksApi, usersApi } from '../../api'
import { useAuth } from '../../context/AuthContext'
import TaskCard from './TaskCard'
import TaskDetailPanel from './TaskDetailPanel'

const todayISO = () => new Date().toISOString().slice(0, 10)

// "My Day" — dipindah dari modul Tugas ke Dashboard supaya jadi titik masuk
// utama alur harian: tambah/cek tugas hari ini di sini, begitu selesai
// otomatis "lulus" ke CompletedHistory di bawahnya (lihat Dashboard.jsx).
export default function MyDayToday() {
  const qc = useQueryClient()
  const { user, hasPermission, isSuperAdmin, isAdmin } = useAuth()
  const [quickTitle, setQuickTitle] = useState('')
  const [selectedId, setSelectedId] = useState(null)

  const params = { view: 'my_day', mine: 'true', limit: 100, sortBy: 'created' }
  const { data, isLoading } = useQuery({
    queryKey: ['tasks', params],
    queryFn: () => tasksApi.list(params),
  })
  // Begitu ditandai selesai, task langsung "lulus" keluar dari checklist hari
  // ini — riwayatnya baru muncul di CompletedHistory di bawahnya (dikelompokkan
  // per minggu/bulan), bukan menumpuk di sini dengan coretan.
  const allTasks = data?.data ?? []
  const tasks = allTasks.filter(t => t.status !== 'DONE')
  const openCount = tasks.length

  const { data: usersRes } = useQuery({ queryKey: ['users', 'for-tasks'], queryFn: () => usersApi.list({ limit: 500 }) })
  const userOptions = usersRes?.data ?? []

  const selectedTask = tasks.find(t => t.id === selectedId) || null
  const canDeleteSelected = !!selectedTask && (
    isSuperAdmin || isAdmin || hasPermission('tasks.delete') || hasPermission('tasks.manage') || selectedTask.createdBy === user?.id
  )

  const invalidate = () => qc.invalidateQueries({ queryKey: ['tasks'] })

  const quickAdd = useMutation({
    mutationFn: (title) => tasksApi.create({ title, myDayDate: todayISO() }),
    onSuccess: () => { invalidate(); setQuickTitle('') },
    onError: e => toast.error(e.response?.data?.message || 'Gagal menambah tugas'),
  })

  const toggleDone = useMutation({
    mutationFn: ({ id, status }) => tasksApi.update(id, { status }),
    onSuccess: invalidate,
    onError: e => toast.error(e.response?.data?.message || 'Error'),
  })

  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-warning-light">
            <Sun size={18} className="text-warning" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-800">Tugas Hari Ini</p>
            <p className="text-xs text-slate-400">
              {openCount > 0 ? `${openCount} tugas belum selesai` : 'Semua tugas hari ini sudah beres 🎉'}
            </p>
          </div>
        </div>
      </div>

      <form
        onSubmit={e => { e.preventDefault(); if (quickTitle.trim()) quickAdd.mutate(quickTitle.trim()) }}
        className="flex gap-2 mb-4"
      >
        <input
          className="input flex-1"
          placeholder="Tambah tugas untuk hari ini…"
          value={quickTitle}
          onChange={e => setQuickTitle(e.target.value)}
        />
        <button type="submit" disabled={quickAdd.isPending || !quickTitle.trim()} className="btn-primary px-3">
          <Plus size={14} />
        </button>
      </form>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => <div key={i} className="h-12 bg-slate-100 rounded-lg animate-pulse" />)}
        </div>
      ) : tasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <PartyPopper size={26} className="text-slate-300 mb-2" />
          <p className="text-sm text-slate-400 max-w-xs">Belum ada tugas untuk hari ini — tambahkan lewat kotak di atas.</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {tasks.map(task => (
            <TaskCard
              key={task.id}
              task={task}
              onOpen={(t) => setSelectedId(t.id)}
              onToggleDone={(t) => toggleDone.mutate({ id: t.id, status: t.status === 'DONE' ? 'TODO' : 'DONE' })}
            />
          ))}
        </div>
      )}

      <TaskDetailPanel
        task={selectedTask}
        userOptions={userOptions}
        onClose={() => setSelectedId(null)}
        canDelete={canDeleteSelected}
      />
    </div>
  )
}
