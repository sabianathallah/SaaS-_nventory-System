import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { dbLinksApi } from '../api'
import { useAuth } from '../context/AuthContext'
import {
  Folder, FolderOpen, Plus, ChevronRight, X,
  Edit2, Trash2, ExternalLink, Search, FileText,
  Loader2, AlertCircle,
} from 'lucide-react'
import toast from 'react-hot-toast'

const COLORS = ['#6366f1','#10b981','#f59e0b','#ef4444','#3b82f6','#8b5cf6','#ec4899','#14b8a6','#f97316','#64748b']

// ── Folder Modal ──────────────────────────────────────────────────────────────

function FolderModal({ folder, onClose, onSaved }) {
  const [name,  setName]  = useState(folder?.name  ?? '')
  const [color, setColor] = useState(folder?.color ?? '#6366f1')
  const [desc,  setDesc]  = useState(folder?.description ?? '')
  const [error, setError] = useState('')

  const qc = useQueryClient()
  const save = useMutation({
    mutationFn: (payload) => folder
      ? dbLinksApi.updateFolder(folder.id, payload)
      : dbLinksApi.createFolder(payload),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['db-folders'] })
      onSaved(res.data)
      onClose()
    },
    onError: (e) => setError(e.response?.data?.message || 'Error'),
  })

  function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) { setError('Nama folder wajib diisi'); return }
    save.mutate({ name: name.trim(), color, description: desc.trim() || null })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm animate-fade-in">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-800">{folder ? 'Edit Folder' : 'Folder Baru'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="label">Nama Folder</label>
            <input autoFocus className="input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Laporan Keuangan" />
          </div>
          <div>
            <label className="label">Deskripsi (opsional)</label>
            <input className="input" value={desc} onChange={e => setDesc(e.target.value)} placeholder="Keterangan singkat…" />
          </div>
          <div>
            <label className="label mb-2">Warna</label>
            <div className="flex gap-2 flex-wrap">
              {COLORS.map(c => (
                <button key={c} type="button" onClick={() => setColor(c)}
                  className={`w-6 h-6 rounded-full transition-all ${color === c ? 'ring-2 ring-offset-1 ring-slate-500' : ''}`}
                  style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>
          {error && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle size={12} />{error}</p>}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 justify-center">Batal</button>
            <button type="submit" disabled={save.isPending || !name.trim()} className="btn-primary flex-1 justify-center">
              {save.isPending && <Loader2 size={13} className="animate-spin" />}
              {folder ? 'Simpan' : 'Buat'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Link Modal ────────────────────────────────────────────────────────────────

function LinkModal({ link, folderId, onClose, onSaved }) {
  const [title, setTitle] = useState(link?.title ?? '')
  const [url,   setUrl]   = useState(link?.url   ?? '')
  const [desc,  setDesc]  = useState(link?.description ?? '')
  const [error, setError] = useState('')

  const qc = useQueryClient()
  const save = useMutation({
    mutationFn: (payload) => link
      ? dbLinksApi.updateLink(folderId, link.id, payload)
      : dbLinksApi.createLink(folderId, payload),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['db-links', folderId] })
      qc.invalidateQueries({ queryKey: ['db-folders'] })
      onSaved(res.data)
      onClose()
    },
    onError: (e) => setError(e.response?.data?.message || 'Error'),
  })

  function handleSubmit(e) {
    e.preventDefault()
    if (!title.trim()) { setError('Judul wajib diisi'); return }
    if (!url.trim())   { setError('URL wajib diisi'); return }
    save.mutate({ title: title.trim(), url: url.trim(), description: desc.trim() || null })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm animate-fade-in">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-800">{link ? 'Edit Link' : 'Tambah Link'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="label">Nama tampilan</label>
            <input autoFocus className="input" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Laporan Juni 2026" />
            <p className="text-[10px] text-slate-400 mt-1">Nama yang ditampilkan ke user, bukan URL-nya</p>
          </div>
          <div>
            <label className="label">Link / URL</label>
            <input type="url" className="input" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://drive.google.com/…" />
          </div>
          <div>
            <label className="label">Catatan (opsional)</label>
            <input className="input" value={desc} onChange={e => setDesc(e.target.value)} placeholder="Keterangan singkat…" />
          </div>
          {error && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle size={12} />{error}</p>}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 justify-center">Batal</button>
            <button type="submit" disabled={save.isPending || !title.trim() || !url.trim()} className="btn-primary flex-1 justify-center">
              {save.isPending && <Loader2 size={13} className="animate-spin" />}
              {link ? 'Simpan' : 'Tambah'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function DatabaseLinks() {
  const { hasPermission } = useAuth()
  const canManage  = hasPermission('db_link.manage')
  const canAddLink = hasPermission('db_link.manage') || hasPermission('db_link.add_link')

  const qc = useQueryClient()
  const [activeFolder, setActiveFolder] = useState(null)
  const [search,       setSearch]       = useState('')
  const [folderModal,  setFolderModal]  = useState({ open: false, folder: null })
  const [linkModal,    setLinkModal]    = useState({ open: false, link: null })

  const { data: foldersData, isLoading: loadingFolders } = useQuery({
    queryKey: ['db-folders'],
    queryFn:  dbLinksApi.listFolders,
  })
  const folders = foldersData?.data ?? []

  const { data: linksData, isLoading: loadingLinks } = useQuery({
    queryKey: ['db-links', activeFolder?.id],
    queryFn:  () => dbLinksApi.listLinks(activeFolder.id),
    enabled:  !!activeFolder,
  })
  const allLinks = linksData?.data ?? []
  const filteredLinks = search
    ? allLinks.filter(l =>
        l.title.toLowerCase().includes(search.toLowerCase()) ||
        (l.description ?? '').toLowerCase().includes(search.toLowerCase())
      )
    : allLinks

  const deleteFolder = useMutation({
    mutationFn: (id) => dbLinksApi.deleteFolder(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['db-folders'] })
      if (activeFolder) setActiveFolder(null)
      toast.success('Folder dihapus')
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Gagal menghapus folder'),
  })

  const deleteLink = useMutation({
    mutationFn: ({ folderId, linkId }) => dbLinksApi.deleteLink(folderId, linkId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['db-links', activeFolder?.id] })
      qc.invalidateQueries({ queryKey: ['db-folders'] })
      toast.success('Link dihapus')
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Gagal menghapus link'),
  })

  function confirmDeleteFolder(folder) {
    if (!confirm(`Hapus folder "${folder.name}"? Semua link di dalamnya juga akan terhapus.`)) return
    deleteFolder.mutate(folder.id)
  }

  function confirmDeleteLink(link) {
    if (!confirm(`Hapus "${link.title}"?`)) return
    deleteLink.mutate({ folderId: activeFolder.id, linkId: link.id })
  }

  // ── Folder grid ──────────────────────────────────────────────────────────────
  if (!activeFolder) {
    return (
      <div className="px-6 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-800">Database Links</h1>
            <p className="text-sm text-slate-400 mt-0.5">Direktori link cepat — klik folder untuk membuka</p>
          </div>
          {canManage && (
            <button onClick={() => setFolderModal({ open: true, folder: null })} className="btn-primary">
              <Plus size={14} /> Folder Baru
            </button>
          )}
        </div>

        {loadingFolders ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 size={24} className="animate-spin text-slate-300" />
          </div>
        ) : folders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3 text-slate-400">
            <Folder size={40} className="text-slate-200" />
            <p className="text-sm">Belum ada folder</p>
            {canManage && (
              <button onClick={() => setFolderModal({ open: true, folder: null })} className="text-xs text-brand hover:underline flex items-center gap-1">
                <Plus size={12} /> Buat folder pertama
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {folders.map(folder => (
              <div key={folder.id} className="group relative">
                <button
                  onClick={() => setActiveFolder(folder)}
                  className="w-full flex flex-col items-center gap-3 p-5 bg-white border border-slate-100 rounded-xl hover:border-slate-300 hover:shadow-md transition-all"
                >
                  <div className="w-14 h-14 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${folder.color}20` }}>
                    <Folder size={28} style={{ color: folder.color }} />
                  </div>
                  <div className="w-full text-center space-y-0.5">
                    <p className="text-sm font-medium text-slate-800 truncate">{folder.name}</p>
                    <p className="text-[11px] text-slate-400">{folder.linkCount ?? 0} item</p>
                  </div>
                </button>
                {canManage && (
                  <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={e => { e.stopPropagation(); setFolderModal({ open: true, folder }) }}
                      className="p-1.5 bg-white border border-slate-200 rounded-lg text-slate-400 hover:text-slate-700 shadow-sm" title="Edit folder">
                      <Edit2 size={11} />
                    </button>
                    <button onClick={e => { e.stopPropagation(); confirmDeleteFolder(folder) }}
                      className="p-1.5 bg-white border border-slate-200 rounded-lg text-slate-400 hover:text-red-500 shadow-sm" title="Hapus folder">
                      <Trash2 size={11} />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {folderModal.open && (
          <FolderModal
            folder={folderModal.folder}
            onClose={() => setFolderModal({ open: false, folder: null })}
            onSaved={() => {}}
          />
        )}
      </div>
    )
  }

  // ── Folder contents ──────────────────────────────────────────────────────────
  return (
    <div className="px-6 py-6 space-y-5">
      {/* Breadcrumb */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2 min-w-0 flex-wrap">
          <button
            onClick={() => { setActiveFolder(null); setSearch('') }}
            className="text-sm text-slate-500 hover:text-brand transition-colors"
          >
            Database Links
          </button>
          <ChevronRight size={13} className="text-slate-300 flex-shrink-0" />
          <div className="flex items-center gap-2">
            <FolderOpen size={16} style={{ color: activeFolder.color }} />
            <span className="text-sm font-semibold text-slate-900">{activeFolder.name}</span>
          </div>
          {activeFolder.description && (
            <span className="text-xs text-slate-400 hidden sm:block">— {activeFolder.description}</span>
          )}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="relative">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text" placeholder="Cari…" value={search} onChange={e => setSearch(e.target.value)}
              className="pl-7 pr-6 py-1.5 text-xs border border-slate-200 rounded-lg outline-none focus:border-brand w-32 bg-white"
            />
            {search && <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400"><X size={11} /></button>}
          </div>
          {canAddLink && (
            <button onClick={() => setLinkModal({ open: true, link: null })} className="btn-primary text-xs px-3 py-1.5">
              <Plus size={13} /> Tambah Link
            </button>
          )}
        </div>
      </div>

      {/* Link list */}
      <div className="card overflow-hidden">
        {loadingLinks ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={20} className="animate-spin text-slate-300" />
          </div>
        ) : filteredLinks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2 text-slate-400">
            <FileText size={32} className="text-slate-200" />
            <p className="text-sm">{search ? 'Tidak ada hasil' : 'Folder ini kosong'}</p>
            {!search && canAddLink && (
              <button onClick={() => setLinkModal({ open: true, link: null })} className="text-xs text-brand hover:underline flex items-center gap-1 mt-1">
                <Plus size={12} /> Tambah link pertama
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {filteredLinks.map((link, idx) => (
              <div key={link.id} className="group flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50/70 transition-colors">
                <span className="text-xs text-slate-300 w-5 text-right flex-shrink-0 tabular-nums">{idx + 1}</span>
                <a href={link.url} target="_blank" rel="noopener noreferrer" className="flex-1 min-w-0 group/link">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium text-slate-800 group-hover/link:text-brand transition-colors truncate">
                      {link.title}
                    </span>
                    <ExternalLink size={11} className="text-slate-300 group-hover/link:text-brand flex-shrink-0 opacity-0 group-hover/link:opacity-100 transition-all" />
                  </div>
                  {link.description && (
                    <p className="text-[11px] text-slate-400 truncate mt-0.5">{link.description}</p>
                  )}
                </a>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <span className="text-[10px] text-slate-300 hidden sm:block">{link.Creator?.name}</span>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {canAddLink && (
                      <button onClick={() => setLinkModal({ open: true, link })}
                        className="p-1.5 text-slate-400 hover:text-brand hover:bg-brand/5 rounded-lg">
                        <Edit2 size={12} />
                      </button>
                    )}
                    {canManage && (
                      <button onClick={() => confirmDeleteLink(link)}
                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg">
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {!loadingLinks && filteredLinks.length > 0 && (
        <p className="text-xs text-slate-400 text-right">{filteredLinks.length} item</p>
      )}

      {linkModal.open && (
        <LinkModal
          link={linkModal.link}
          folderId={activeFolder.id}
          onClose={() => setLinkModal({ open: false, link: null })}
          onSaved={() => {}}
        />
      )}
    </div>
  )
}
