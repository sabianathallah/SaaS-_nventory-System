import { ArrowLeft } from 'lucide-react'

// Breadcrumb di atas workspace sebuah folder divisi. Dulu baris ini juga
// memuat pill "Lists" per divisi; Lists sudah dipensiunkan (tidak pernah
// dipakai dan perannya diambil Projects yang lintas divisi), jadi yang
// tersisa hanya jalur kembali ke grid folder.
export default function DivisionWorkspaceBar({ divisi, onBack }) {
  return (
    <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50">
      <button onClick={onBack} className="flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-slate-700 transition-colors">
        <ArrowLeft size={12} />Folders <span className="text-slate-300">/</span> <span className="text-slate-700 font-semibold">{divisi}</span>
      </button>
    </div>
  )
}
