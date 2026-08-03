import { useState, useRef, useEffect, useCallback } from 'react'
import { X, ZoomIn, ZoomOut, Maximize } from 'lucide-react'

const MIN_SCALE = 1
const MAX_SCALE = 5

// Lightbox foto di tab yang sama — pola sama dengan lightbox avatar leaderboard.
// Zoom: scroll / tombol +/− / double-klik. Saat zoom, foto bisa di-drag untuk geser.
// Render kondisional dari parent: {photo && <ImageLightbox src={photo} onClose={...} />}
export default function ImageLightbox({ src, alt, onClose }) {
  const [scale, setScale] = useState(1)
  const [pos, setPos]     = useState({ x: 0, y: 0 })
  const containerRef = useRef(null)
  const dragRef      = useRef(null) // { startX, startY, origX, origY }

  const zoomTo = useCallback((next) => {
    const s = Math.min(MAX_SCALE, Math.max(MIN_SCALE, next))
    setScale(s)
    if (s === MIN_SCALE) setPos({ x: 0, y: 0 })
  }, [])

  // Wheel zoom — pakai addEventListener non-passive supaya preventDefault jalan
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const onWheel = (e) => {
      e.preventDefault()
      setScale(prev => {
        const s = Math.min(MAX_SCALE, Math.max(MIN_SCALE, prev + (e.deltaY < 0 ? 0.35 : -0.35)))
        if (s === MIN_SCALE) setPos({ x: 0, y: 0 })
        return s
      })
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  // Tutup dengan tombol Escape
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!src) return null

  const onPointerDown = (e) => {
    if (scale === 1) return
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: pos.x, origY: pos.y }
  }
  const onPointerMove = (e) => {
    if (!dragRef.current) return
    setPos({
      x: dragRef.current.origX + (e.clientX - dragRef.current.startX),
      y: dragRef.current.origY + (e.clientY - dragRef.current.startY),
    })
  }
  const onPointerUp = () => { dragRef.current = null }

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 px-4 animate-fade-in overflow-hidden"
      onClick={onClose}
    >
      {/* Toolbar zoom */}
      <div
        className="absolute top-4 right-4 flex items-center gap-1 bg-black/40 rounded-full px-2 py-1.5 z-10"
        onClick={e => e.stopPropagation()}
      >
        <button onClick={() => zoomTo(scale - 0.5)} disabled={scale <= MIN_SCALE}
          className="p-1.5 rounded-full text-white/80 hover:text-white hover:bg-white/10 disabled:opacity-30" title="Perkecil">
          <ZoomOut size={16} />
        </button>
        <span className="text-white/70 text-xs font-mono w-11 text-center select-none">{Math.round(scale * 100)}%</span>
        <button onClick={() => zoomTo(scale + 0.5)} disabled={scale >= MAX_SCALE}
          className="p-1.5 rounded-full text-white/80 hover:text-white hover:bg-white/10 disabled:opacity-30" title="Perbesar">
          <ZoomIn size={16} />
        </button>
        <button onClick={() => zoomTo(1)} disabled={scale === 1}
          className="p-1.5 rounded-full text-white/80 hover:text-white hover:bg-white/10 disabled:opacity-30" title="Reset zoom">
          <Maximize size={15} />
        </button>
        <div className="w-px h-4 bg-white/20 mx-0.5" />
        <button onClick={onClose} className="p-1.5 rounded-full text-white/80 hover:text-white hover:bg-white/10" title="Tutup (Esc)">
          <X size={16} />
        </button>
      </div>

      <div className="flex flex-col items-center gap-3" onClick={e => e.stopPropagation()}>
        <img
          src={src}
          alt={alt || 'Foto'}
          draggable={false}
          onDoubleClick={() => zoomTo(scale > 1 ? 1 : 2.5)}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          style={{
            transform: `translate(${pos.x}px, ${pos.y}px) scale(${scale})`,
            transition: dragRef.current ? 'none' : 'transform 120ms ease-out',
            cursor: scale > 1 ? 'grab' : 'zoom-in',
            touchAction: 'none',
          }}
          className="max-w-[90vw] max-h-[80vh] rounded-2xl object-contain shadow-modal select-none"
        />
        {alt && scale === 1 && <p className="text-white text-sm font-semibold">{alt}</p>}
        {scale === 1 && (
          <p className="text-white/50 text-[11px]">Scroll / double-klik untuk zoom · Esc untuk tutup</p>
        )}
      </div>
    </div>
  )
}
