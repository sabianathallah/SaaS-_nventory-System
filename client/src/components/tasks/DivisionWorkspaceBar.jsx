import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Plus, X, Trash2 } from 'lucide-react'
import { taskListsApi } from '../../api'

const LIST_COLORS = ['#C8102E', '#2563EB', '#16A34A', '#D97706', '#7C3AED', '#0D9488']

// Breadcrumb + per-divisi Lists pill row, shown at the top of a folder
// workspace — Lists live inside a divisi now (shared, not personal), so this
// replaces the old always-visible "Lists" section in TasksSidebar.
export default function DivisionWorkspaceBar({ divisi, activeListId, onBack, onSelectRoot, onSelectList, canManage }) {
  const qc = useQueryClient()
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')

  const { data: lists } = useQuery({
    queryKey: ['task-lists', divisi],
    queryFn: () => taskListsApi.list({ divisi }),
    enabled: !!divisi,
  })

  const create = useMutation({
    mutationFn: (n) => taskListsApi.create({ name: n, divisi, color: LIST_COLORS[(lists?.length ?? 0) % LIST_COLORS.length] }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['task-lists', divisi] }); setName(''); setCreating(false) },
  })
  const remove = useMutation({
    mutationFn: (id) => taskListsApi.remove(id),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ['task-lists', divisi] })
      qc.invalidateQueries({ queryKey: ['tasks'] })
      if (String(activeListId) === String(id)) onSelectRoot()
    },
  })

  return (
    <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50 space-y-2">
      <button onClick={onBack} className="flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-slate-700 transition-colors">
        <ArrowLeft size={12} />Folders <span className="text-slate-300">/</span> <span className="text-slate-700 font-semibold">{divisi}</span>
      </button>

      <div className="flex items-center gap-1.5 flex-wrap">
        <button
          onClick={onSelectRoot}
          className={`text-[11px] font-semibold px-2.5 py-1 rounded-full transition-colors ${
            !activeListId ? 'nav-active' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
          }`}
        >
          Semua
        </button>
        {(lists ?? []).map(list => {
          const isActive = String(activeListId) === String(list.id)
          return (
            <span
              key={list.id}
              onClick={() => onSelectList(list.id)}
              className={`group inline-flex items-center gap-1.5 text-[11px] font-semibold pl-2.5 pr-1.5 py-1 rounded-full cursor-pointer transition-colors ${
                isActive ? 'nav-active' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              }`}
            >
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: list.color }} />
              {list.name}
              {canManage && (
                <button
                  onClick={(e) => { e.stopPropagation(); if (confirm(`Hapus list "${list.name}"?`)) remove.mutate(list.id) }}
                  className={`opacity-0 group-hover:opacity-100 flex-shrink-0 transition-opacity ${isActive ? 'text-white/70 hover:text-white' : 'text-slate-400 hover:text-danger'}`}
                >
                  <Trash2 size={10} />
                </button>
              )}
            </span>
          )
        })}
        {canManage && (creating ? (
          <form onSubmit={e => { e.preventDefault(); if (name.trim()) create.mutate(name.trim()) }} className="inline-flex items-center gap-1">
            <input
              autoFocus
              className="input text-xs py-1 px-2 w-28"
              placeholder="Nama list…"
              value={name}
              onChange={e => setName(e.target.value)}
              onBlur={() => { if (!name.trim()) setCreating(false) }}
            />
            <button type="button" onClick={() => { setCreating(false); setName('') }} className="text-slate-400 hover:text-slate-700">
              <X size={13} />
            </button>
          </form>
        ) : (
          <button onClick={() => setCreating(true)} className="text-[11px] font-semibold px-2 py-1 rounded-full text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-colors inline-flex items-center gap-1">
            <Plus size={11} />List
          </button>
        ))}
      </div>
    </div>
  )
}
