import { useQuery } from '@tanstack/react-query'
import { FolderKanban, ChevronRight } from 'lucide-react'
import { tasksApi } from '../../api'
import { useAuth } from '../../context/AuthContext'

// Same deterministic-hue idea as avatarColor() in taskConfig.js, but a wider
// tile-friendly palette (folder tiles need to stay legible with white text).
const FOLDER_HUES = [
  'from-brand to-brand-dark', 'from-info to-blue-700', 'from-success to-green-700',
  'from-warning to-amber-700', 'from-purple-600 to-purple-800', 'from-teal-600 to-teal-800',
]
function folderHue(name) {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0
  return FOLDER_HUES[hash % FOLDER_HUES.length]
}

export default function DivisionFolders({ onSelect }) {
  const { user } = useAuth()
  const { data, isLoading } = useQuery({ queryKey: ['task-divisions'], queryFn: tasksApi.listDivisions })
  const divisions = data ?? []

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="mb-6">
        <h2 className="text-lg font-bold text-slate-800">Folder Divisi</h2>
        <p className="text-sm text-slate-400 mt-0.5">Pilih divisi untuk melihat task dan list kerja tim tersebut.</p>
      </div>

      {isLoading ? (
        <p className="text-sm text-slate-400 text-center py-16">Memuat…</p>
      ) : divisions.length === 0 ? (
        <div className="card p-8 text-center">
          <FolderKanban size={28} className="mx-auto text-slate-300 mb-2" />
          <p className="text-sm text-slate-400">Belum ada divisi yang terdaftar. Isi kolom Divisi di halaman User untuk membuat folder.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {divisions.map(d => (
            <button
              key={d.divisi}
              type="button"
              onClick={() => onSelect(d.divisi)}
              className="card p-0 text-left overflow-hidden transition-all hover:shadow-card-md hover:-translate-y-0.5"
            >
              <div className={`h-16 bg-gradient-to-br ${folderHue(d.divisi)} flex items-center justify-between px-4`}>
                <FolderKanban size={22} className="text-white/90" />
                {d.divisi === user?.divisi && (
                  <span className="text-[10px] font-bold text-white/90 bg-white/20 px-2 py-0.5 rounded-full">Divisi Saya</span>
                )}
              </div>
              <div className="p-4 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-800 truncate">{d.divisi}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{d.openCount} aktif · {d.taskCount} total task</p>
                </div>
                <ChevronRight size={16} className="text-slate-300 flex-shrink-0" />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
