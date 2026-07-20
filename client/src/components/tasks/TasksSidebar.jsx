import { useAuth } from '../../context/AuthContext'
import { SIDEBAR_VIEWS, ALL_TASKS_VIEW } from './taskConfig'

export default function TasksSidebar({ active, onSelect }) {
  const { hasPermission, isSuperAdmin, isAdmin } = useAuth()
  const canSeeAll = isSuperAdmin || isAdmin || hasPermission('tasks.view') || hasPermission('tasks.manage')
  const items = canSeeAll ? [...SIDEBAR_VIEWS, ALL_TASKS_VIEW] : SIDEBAR_VIEWS

  return (
    <div className="w-52 flex-shrink-0 border-r border-slate-100 py-3 px-2 space-y-0.5">
      {items.map((item) => (
        <button
          key={item.id}
          onClick={() => onSelect(item.id)}
          className={`flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm transition-colors ${
            active === item.id
              ? 'bg-slate-800 text-white font-semibold'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <item.icon size={14} className="flex-shrink-0" />
          <span className="truncate">{item.label}</span>
        </button>
      ))}
    </div>
  )
}
