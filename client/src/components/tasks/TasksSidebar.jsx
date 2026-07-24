import { useAuth } from '../../context/AuthContext'
import { SIDEBAR_VIEWS, ALL_TASKS_VIEW, FOLDERS_VIEW } from './taskConfig'

export default function TasksSidebar({ active, onSelect }) {
  const { hasPermission, isSuperAdmin, isAdmin } = useAuth()
  const canSeeAll = isSuperAdmin || isAdmin || hasPermission('tasks.view') || hasPermission('tasks.manage')
  const items = canSeeAll ? [...SIDEBAR_VIEWS, ALL_TASKS_VIEW] : SIDEBAR_VIEWS

  // "Folders" (per-divisi workspace) is a separate browsing mode from the
  // fixed cross-divisi views below — kept as its own row so it always reads
  // as the entry point, matching how it's the landing view on open.
  const isFolderContext = active === 'folders' || active.startsWith('division:') || active.startsWith('divlist:')

  return (
    <div className="w-56 flex-shrink-0 border-r border-slate-100 bg-offwhite/40 py-4 px-2.5 space-y-0.5 overflow-y-auto">
      <button
        onClick={() => onSelect('folders')}
        className={`flex items-center gap-2.5 w-full px-2.5 py-2 rounded-lg text-sm transition-colors mb-2 ${
          isFolderContext ? 'nav-active font-semibold shadow-sm' : 'text-slate-600 hover:bg-white hover:text-slate-900'
        }`}
      >
        <FOLDERS_VIEW.icon size={14} className="flex-shrink-0" strokeWidth={isFolderContext ? 2.4 : 1.9} />
        <span className="truncate flex-1 text-left">{FOLDERS_VIEW.label}</span>
      </button>

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
    </div>
  )
}
