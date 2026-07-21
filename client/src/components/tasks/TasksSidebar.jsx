import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, X, Trash2 } from 'lucide-react'
import { taskListsApi } from '../../api'
import { useAuth } from '../../context/AuthContext'
import { SIDEBAR_VIEWS, ALL_TASKS_VIEW } from './taskConfig'

const LIST_COLORS = ['#C8102E', '#2563EB', '#16A34A', '#D97706', '#7C3AED', '#0D9488']

export default function TasksSidebar({ active, onSelect }) {
  const qc = useQueryClient()
  const { hasPermission, isSuperAdmin, isAdmin } = useAuth()
  const canSeeAll = isSuperAdmin || isAdmin || hasPermission('tasks.view') || hasPermission('tasks.manage')
  const items = canSeeAll ? [...SIDEBAR_VIEWS, ALL_TASKS_VIEW] : SIDEBAR_VIEWS

  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')

  const { data: lists } = useQuery({ queryKey: ['task-lists'], queryFn: taskListsApi.list })

  const create = useMutation({
    mutationFn: (n) => taskListsApi.create({ name: n, color: LIST_COLORS[(lists?.length ?? 0) % LIST_COLORS.length] }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['task-lists'] }); setName(''); setCreating(false) },
  })
  const remove = useMutation({
    mutationFn: (id) => taskListsApi.remove(id),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ['task-lists'] })
      qc.invalidateQueries({ queryKey: ['tasks'] })
      if (active === `list:${id}`) onSelect('dashboard')
    },
  })

  return (
    <div className="w-56 flex-shrink-0 border-r border-slate-100 bg-offwhite/40 py-4 px-2.5 space-y-0.5 overflow-y-auto">
      <p className="px-2.5 pb-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tampilan</p>
      {items.map((item) => {
        const isActive = active === item.id
        return (
          <button
            key={item.id}
            onClick={() => onSelect(item.id)}
            className={`flex items-center gap-2.5 w-full px-2.5 py-2 rounded-lg text-sm transition-colors ${
              isActive ? 'nav-active font-semibold shadow-sm' : 'text-slate-600 hover:bg-white hover:text-slate-900'
            }`}
          >
            <item.icon size={14} className="flex-shrink-0" strokeWidth={isActive ? 2.4 : 1.9} />
            <span className="truncate flex-1 text-left">{item.label}</span>
          </button>
        )
      })}

      <div className="flex items-center justify-between px-2.5 pt-4 pb-2">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Lists</p>
        <button onClick={() => setCreating(v => !v)} className="text-slate-400 hover:text-slate-700 transition-colors">
          {creating ? <X size={13} /> : <Plus size={13} />}
        </button>
      </div>

      {creating && (
        <form
          onSubmit={e => { e.preventDefault(); if (name.trim()) create.mutate(name.trim()) }}
          className="px-2.5 pb-2"
        >
          <input
            autoFocus
            className="input text-xs py-1.5"
            placeholder="Nama list…"
            value={name}
            onChange={e => setName(e.target.value)}
          />
        </form>
      )}

      {(lists ?? []).map((list) => {
        const key = `list:${list.id}`
        const isActive = active === key
        return (
          <div
            key={list.id}
            className={`group flex items-center gap-2.5 w-full px-2.5 py-2 rounded-lg text-sm transition-colors cursor-pointer ${
              isActive ? 'nav-active font-semibold shadow-sm' : 'text-slate-600 hover:bg-white hover:text-slate-900'
            }`}
            onClick={() => onSelect(key)}
          >
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: list.color }} />
            <span className="truncate flex-1 text-left">{list.name}</span>
            <button
              onClick={(e) => { e.stopPropagation(); if (confirm(`Hapus list "${list.name}"?`)) remove.mutate(list.id) }}
              className={`opacity-0 group-hover:opacity-100 flex-shrink-0 transition-opacity ${isActive ? 'text-white/70 hover:text-white' : 'text-slate-300 hover:text-danger'}`}
            >
              <Trash2 size={12} />
            </button>
          </div>
        )
      })}
    </div>
  )
}
