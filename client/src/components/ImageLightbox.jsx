import { X } from 'lucide-react'

// Lightbox foto di tab yang sama — pola sama dengan lightbox avatar leaderboard.
// Render kondisional dari parent: {photo && <ImageLightbox src={photo} onClose={...} />}
export default function ImageLightbox({ src, alt, onClose }) {
  if (!src) return null
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 px-4 animate-fade-in"
      onClick={onClose}
    >
      <div className="flex flex-col items-center gap-3" onClick={e => e.stopPropagation()}>
        <img src={src} alt={alt || 'Foto'} className="max-w-[90vw] max-h-[80vh] rounded-2xl object-contain shadow-modal" />
        {alt && <p className="text-white text-sm font-semibold">{alt}</p>}
        <button onClick={onClose} className="text-white/70 hover:text-white text-xs flex items-center gap-1">
          <X size={12} /> Tutup
        </button>
      </div>
    </div>
  )
}
