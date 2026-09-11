import { useQuery } from '@tanstack/react-query'
import { hrisApi } from '../../api'
import { useAuth } from '../../context/AuthContext'
import { FolderOpen, IdCard, FileText, FileSignature, File as FileIcon, ExternalLink } from 'lucide-react'

const TYPE_LABEL = { KTP: 'KTP', NPWP: 'NPWP', CONTRACT: 'Kontrak Kerja', OTHER: 'Lainnya' }
const TYPE_ICON = { KTP: IdCard, NPWP: FileText, CONTRACT: FileSignature, OTHER: FileIcon }

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

// Badge kedaluwarsa — merah kalau sudah lewat, kuning kalau <=30 hari lagi,
// gak ada badge kalau masih jauh atau gak ada tanggal expiry sama sekali.
function ExpiryBadge({ expiryDate }) {
  if (!expiryDate) return null
  const daysLeft = Math.ceil((new Date(expiryDate) - new Date()) / 86400000)
  if (daysLeft < 0) return <span className="badge-red">Kedaluwarsa</span>
  if (daysLeft <= 30) return <span className="badge-amber">Akan kedaluwarsa ({daysLeft}h)</span>
  return null
}

export default function Documents() {
  const { user } = useAuth()
  // Halaman ini khusus dokumen MILIK SENDIRI — userId dikirim eksplisit
  // biar konsisten sama Payslip.jsx, walau backend juga otomatis scope ke
  // req.user.id kalau caller gak punya hris.document.manage.
  const { data: list, isLoading } = useQuery({
    queryKey: ['hris-employee-documents', 'self', user?.id],
    queryFn: () => hrisApi.employeeDocuments({ limit: 100, userId: user?.id }),
    enabled: !!user?.id,
  })

  const rows = list?.data ?? []

  return (
    <div className="px-6 py-6 max-w-3xl">
      <div className="mb-5">
        <h1 className="text-lg font-bold text-slate-800">Dokumen Saya</h1>
        <p className="text-xs text-slate-400 mt-0.5">KTP, NPWP, kontrak kerja, dan dokumen lain yang diunggah admin</p>
      </div>

      {isLoading ? (
        <div className="card p-8 text-center text-sm text-slate-400">Memuat…</div>
      ) : rows.length === 0 ? (
        <div className="card p-8 text-center">
          <FolderOpen size={28} className="mx-auto text-slate-300 mb-2" />
          <p className="text-sm text-slate-400">Belum ada dokumen yang diunggah</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {rows.map(r => {
            const Icon = TYPE_ICON[r.type] ?? FileIcon
            return (
              <a
                key={r.id}
                href={r.url}
                target="_blank"
                rel="noreferrer"
                className="card p-4 flex items-start gap-3 hover:border-brand/40 transition-colors"
              >
                <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0 text-slate-500">
                  <Icon size={16} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-800 truncate">{r.title}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{TYPE_LABEL[r.type] ?? r.type}</p>
                  {r.expiryDate && <p className="text-[11px] text-slate-400 mt-0.5">Berlaku s/d {fmtDate(r.expiryDate)}</p>}
                  <div className="mt-2"><ExpiryBadge expiryDate={r.expiryDate} /></div>
                </div>
                <ExternalLink size={13} className="text-slate-300 flex-shrink-0" />
              </a>
            )
          })}
        </div>
      )}
    </div>
  )
}
