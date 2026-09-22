import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Trash2, CalendarDays, Boxes, ChevronRight } from 'lucide-react'
import toast from 'react-hot-toast'
import { projectsApi } from '../../api'
import { PROJECT_STATUS_CONFIG, PROJECT_COLORS, avatarColor, initials, fmtDue } from './taskConfig'
import ProjectFormModal from './ProjectFormModal'

// Landing grid untuk lapis "by project" — project bersifat lintas divisi,
// jadi grid ini tidak di-scope ke folder divisi mana pun (beda dengan Lists
// yang hidup di dalam satu divisi, lihat DivisionWorkspaceBar).
export default function ProjectsGrid({ onSelect, userOptions = [] }) {
  const qc = useQueryClient()
  const [editing, setEditing] = useState(null)   // project row saat mode edit
  const [showForm, setShowForm] = useState(false)

  const { data: projects, isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectsApi.list(),
  })

  const remove = useMutation({
    mutationFn: (id) => projectsApi.remove(id),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['projects'] })
      qc.invalidateQueries({ queryKey: ['project-detail'] })
      qc.invalidateQueries({ queryKey: ['tasks'] })
      toast.success(res?.message || 'Project dihapus')
    },
    onError: e => toast.error(e.response?.data?.message || 'Error'),
  })

  const rows = projects ?? []

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-800">Projects</h2>
          <p className="text-sm text-slate-400 mt-0.5">Kelompokkan task lintas divisi ke dalam project beserta progresnya.</p>
        </div>
        <button onClick={() => { setEditing(null); setShowForm(true) }} className="btn-primary flex-shrink-0">
          <Plus size={14} />Project Baru
        </button>
      </div>

      {isLoading ? (
        <p className="text-sm text-slate-400 text-center py-16">Memuat…</p>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-11 h-11 rounded-full bg-slate-100 flex items-center justify-center mb-3">
            <Boxes size={18} className="text-slate-300" />
          </div>
          <p className="text-sm text-slate-400 max-w-xs">Belum ada project. Buat satu untuk mengelompokkan task lintas divisi.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {rows.map(p => {
            const total = Number(p.taskCount) || 0
            const done = Number(p.doneCount) || 0
            const pct = total ? Math.round((done / total) * 100) : 0
            const due = fmtDue(p.dueDate)
            const status = PROJECT_STATUS_CONFIG[p.status] ?? PROJECT_STATUS_CONFIG.ACTIVE
            return (
              <div
                key={p.id}
                onClick={() => onSelect(p.id)}
                className="card p-0 text-left overflow-hidden cursor-pointer transition-all hover:shadow-card-md hover:-translate-y-0.5 group"
              >
                <div className="h-1.5" style={{ background: p.color }} />
                <div className="p-4 space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-bold text-slate-800 truncate flex-1">{p.name}</p>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={(e) => { e.stopPropagation(); setEditing(p); setShowForm(true) }}
                        className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-slate-600 transition-opacity"
                        title="Edit project"
                      >
                        <Pencil size={12} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          if (confirm(`Hapus project "${p.name}"? Task di dalamnya tidak ikut terhapus, hanya dilepas dari project.`)) remove.mutate(p.id)
                        }}
                        className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-danger transition-opacity"
                        title="Hapus project"
                      >
                        <Trash2 size={12} />
                      </button>
                      <ChevronRight size={14} className="text-slate-300" />
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${status.cls}`}>{status.label}</span>
                    {due && (
                      <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                        due.overdue && p.status !== 'DONE' ? 'bg-danger-light text-danger' : 'text-slate-400'
                      }`}>
                        <CalendarDays size={9} />{due.text}
                      </span>
                    )}
                    {p.owner && (
                      <span
                        className={`w-5 h-5 rounded-full text-white text-[9px] font-bold flex items-center justify-center ${avatarColor(p.owner.id)}`}
                        title={`PIC: ${p.owner.name}`}
                      >
                        {initials(p.owner.name)}
                      </span>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                      <span>{done}/{total} task</span>
                      <span className="font-semibold text-slate-500">{pct}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: p.color }} />
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <ProjectFormModal
        open={showForm}
        onClose={() => { setShowForm(false); setEditing(null) }}
        project={editing}
        userOptions={userOptions}
        defaultColor={PROJECT_COLORS[rows.length % PROJECT_COLORS.length]}
      />
    </div>
  )
}
