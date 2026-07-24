import { useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Image as ImageIcon, Video, Link2, X, Trash2 } from 'lucide-react'
import { tasksApi } from '../../api'
import { useAuth } from '../../context/AuthContext'

const MAX_IMAGE = 5 * 1024 * 1024

export default function TaskAttachments({ task, canDelete }) {
  const qc = useQueryClient()
  const { user } = useAuth()
  const fileRef = useRef(null)
  const [addingLink, setAddingLink] = useState(false)
  const [videoUrl, setVideoUrl] = useState('')

  const attachments = task.attachments ?? []

  const invalidate = () => { qc.invalidateQueries({ queryKey: ['tasks'] }) }

  const uploadImage = useMutation({
    mutationFn: (file) => tasksApi.uploadAttachment(task.id, file),
    onSuccess: invalidate,
    onError: e => toast.error(e.response?.data?.message || 'Gagal upload foto'),
  })
  const addLink = useMutation({
    mutationFn: (url) => tasksApi.addVideoLink(task.id, url),
    onSuccess: () => { invalidate(); setVideoUrl(''); setAddingLink(false) },
    onError: e => toast.error(e.response?.data?.message || 'Gagal menambah link video'),
  })
  const remove = useMutation({
    mutationFn: (attachmentId) => tasksApi.removeAttachment(task.id, attachmentId),
    onSuccess: invalidate,
    onError: e => toast.error(e.response?.data?.message || 'Gagal menghapus lampiran'),
  })

  function handleFile(file) {
    if (!file) return
    if (!file.type.startsWith('image/')) return toast.error('File harus berupa gambar')
    if (file.size > MAX_IMAGE) return toast.error('Ukuran file maks 5MB')
    uploadImage.mutate(file)
  }

  return (
    <div className="pt-2 border-t border-slate-100">
      <label className="label mb-2">
        Lampiran{attachments.length > 0 && <span className="text-slate-400 font-normal"> ({attachments.length})</span>}
      </label>

      {attachments.length > 0 && (
        <div className="grid grid-cols-4 gap-2 mb-2">
          {attachments.map(a => (
            <div key={a.id} className="group relative aspect-square rounded-lg overflow-hidden border border-slate-200 bg-slate-50">
              {a.type === 'IMAGE' ? (
                <a href={a.url} target="_blank" rel="noopener noreferrer">
                  <img src={a.url} alt="" className="w-full h-full object-cover" />
                </a>
              ) : (
                <a href={a.url} target="_blank" rel="noopener noreferrer" className="w-full h-full flex flex-col items-center justify-center gap-1 text-slate-400 hover:text-slate-600 transition-colors">
                  <Video size={18} />
                  <span className="text-[9px] px-1 text-center truncate w-full">Video</span>
                </a>
              )}
              {(canDelete || a.userId === user?.id) && (
                <button
                  onClick={() => remove.mutate(a.id)}
                  className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-danger"
                  title="Hapus lampiran"
                >
                  <Trash2 size={10} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2">
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => { handleFile(e.target.files?.[0]); e.target.value = '' }} />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploadImage.isPending}
          className="btn-secondary py-1.5 px-2.5 text-xs"
        >
          <ImageIcon size={12} />{uploadImage.isPending ? 'Mengunggah…' : 'Tambah Foto'}
        </button>
        {!addingLink ? (
          <button type="button" onClick={() => setAddingLink(true)} className="btn-secondary py-1.5 px-2.5 text-xs">
            <Link2 size={12} />Link Video
          </button>
        ) : (
          <form
            onSubmit={e => { e.preventDefault(); if (videoUrl.trim()) addLink.mutate(videoUrl.trim()) }}
            className="flex items-center gap-1.5 flex-1"
          >
            <input
              autoFocus
              type="url"
              className="input text-xs py-1.5 flex-1"
              placeholder="https://…"
              value={videoUrl}
              onChange={e => setVideoUrl(e.target.value)}
            />
            <button type="submit" disabled={addLink.isPending} className="btn-primary py-1.5 px-2.5 text-xs">Simpan</button>
            <button type="button" onClick={() => { setAddingLink(false); setVideoUrl('') }} className="text-slate-400 hover:text-slate-700"><X size={14} /></button>
          </form>
        )}
      </div>
    </div>
  )
}
