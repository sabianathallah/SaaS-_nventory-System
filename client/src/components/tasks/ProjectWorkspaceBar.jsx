import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Pencil, CalendarDays } from 'lucide-react'
import { projectsApi } from '../../api'
import { PROJECT_STATUS_CONFIG, avatarColor, initials, fmtDue } from './taskConfig'
import ProjectFormModal from './ProjectFormModal'

// Breadcrumb + ringkasan project di atas workspace-nya — padanan
// DivisionWorkspaceBar untuk lapis "by project".
export default function ProjectWorkspaceBar({ projectId, onBack, userOptions = [] }) {
  const [editing, setEditing] = useState(false)

  const { data: project } = useQuery({
    queryKey: ['project-detail', projectId],
    queryFn: () => projectsApi.get(projectId),
    enabled: !!projectId,
  })

  if (!project) {
    return (
      <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50">
        <button onClick={onBack} className="flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-slate-700 transition-colors">
          <ArrowLeft size={12} />Projects
        </button>
      </div>
    )
  }

  const total = Number(project.taskCount) || 0
  const done = Number(project.doneCount) || 0
  const pct = total ? Math.round((done / total) * 100) : 0
  const due = fmtDue(project.dueDate)
  const status = PROJECT_STATUS_CONFIG[project.status] ?? PROJECT_STATUS_CONFIG.ACTIVE

  return (
    <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50 space-y-2">
      <button onClick={onBack} className="flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-slate-700 transition-colors">
        <ArrowLeft size={12} />Projects <span className="text-slate-300">/</span>
        <span className="inline-flex items-center gap-1.5 text-slate-700 font-semibold">
          <span className="w-2 h-2 rounded-full" style={{ background: project.color }} />
          {project.name}
        </span>
      </button>

      <div className="flex items-center gap-2 flex-wrap">
        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${status.cls}`}>{status.label}</span>
        {due && (
          <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
            due.overdue && project.status !== 'DONE' ? 'bg-danger-light text-danger' : 'text-slate-400'
          }`}>
            <CalendarDays size={9} />{due.text}
          </span>
        )}
        {project.owner && (
          <span
            className={`w-5 h-5 rounded-full text-white text-[9px] font-bold flex items-center justify-center ${avatarColor(project.owner.id)}`}
            title={`PIC: ${project.owner.name}`}
          >
            {initials(project.owner.name)}
          </span>
        )}

        <span className="flex items-center gap-2 ml-auto">
          <span className="text-[11px] text-slate-400">{done}/{total} task · {pct}%</span>
          <span className="w-24 h-1.5 rounded-full bg-slate-200 overflow-hidden">
            <span className="block h-full rounded-full transition-all" style={{ width: `${pct}%`, background: project.color }} />
          </span>
          <button onClick={() => setEditing(true)} className="text-slate-300 hover:text-slate-600 transition-colors" title="Edit project">
            <Pencil size={12} />
          </button>
        </span>
      </div>

      {project.description && <p className="text-[11px] text-slate-400 max-w-2xl">{project.description}</p>}

      <ProjectFormModal open={editing} onClose={() => setEditing(false)} project={project} userOptions={userOptions} />
    </div>
  )
}
