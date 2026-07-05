import { useEffect, useRef, useState } from 'react'
import { Camera, CameraOff, X, RotateCcw, Check, Loader2 } from 'lucide-react'

// Modal kamera live (getUserMedia) untuk selfie presensi — bukan file picker OS.
export default function CameraCapture({ onCapture, onClose }) {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const [preview, setPreview] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } } })
      .then((stream) => {
        if (!mounted) { stream.getTracks().forEach(t => t.stop()); return }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play()
            setLoading(false)
          }
        }
      })
      .catch(() => { if (mounted) setError('Tidak bisa mengakses kamera. Izinkan akses kamera di browser.') })

    return () => {
      mounted = false
      streamRef.current?.getTracks().forEach(t => t.stop())
    }
  }, [])

  function handleClose() {
    streamRef.current?.getTracks().forEach(t => t.stop())
    onClose()
  }

  function capture() {
    if (!videoRef.current || !canvasRef.current) return
    const ctx = canvasRef.current.getContext('2d')
    canvasRef.current.width = videoRef.current.videoWidth
    canvasRef.current.height = videoRef.current.videoHeight
    ctx.translate(canvasRef.current.width, 0)
    ctx.scale(-1, 1)
    ctx.drawImage(videoRef.current, 0, 0)
    setPreview(canvasRef.current.toDataURL('image/jpeg', 0.85))
  }

  function handleConfirm() {
    if (!preview) return
    streamRef.current?.getTracks().forEach(t => t.stop())
    canvasRef.current.toBlob((blob) => {
      const file = new File([blob], `selfie-${Date.now()}.jpg`, { type: 'image/jpeg' })
      onCapture(file)
    }, 'image/jpeg', 0.85)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-4" onClick={handleClose}>
      <div className="card w-full max-w-sm overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-brand-50 flex items-center justify-center text-brand">
              <Camera size={14} />
            </div>
            <span className="text-sm font-semibold text-slate-800">Foto Selfie</span>
          </div>
          <button onClick={handleClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400">
            <X size={16} />
          </button>
        </div>

        <div className="p-4">
          {error ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
                <CameraOff size={28} className="text-slate-300" />
              </div>
              <p className="text-sm text-slate-500 mb-1">{error}</p>
              <button onClick={handleClose} className="btn-secondary text-sm mt-3">Tutup</button>
            </div>
          ) : (
            <>
              <div className="relative bg-black rounded-xl overflow-hidden aspect-[4/3]">
                <video
                  ref={videoRef}
                  autoPlay muted playsInline
                  className={`w-full h-full object-cover ${preview ? 'hidden' : 'block'}`}
                  style={{ transform: 'scaleX(-1)' }}
                />
                {preview && <img src={preview} alt="Preview" className="w-full h-full object-cover" />}
                {loading && !error && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black">
                    <Loader2 size={24} className="animate-spin text-white" />
                  </div>
                )}
                {!preview && !loading && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-36 h-44 border-2 border-white/60 rounded-full shadow-[0_0_0_4px_rgba(255,255,255,0.15)]" />
                  </div>
                )}
              </div>
              <canvas ref={canvasRef} className="hidden" />

              {!preview && !loading && (
                <p className="text-xs text-slate-400 text-center mt-2">Posisikan wajah di dalam oval</p>
              )}

              <div className="flex gap-2 mt-4">
                {!preview ? (
                  <button onClick={capture} disabled={loading} className="btn-primary text-sm flex-1 justify-center">
                    <Camera size={16} /> Ambil Foto
                  </button>
                ) : (
                  <>
                    <button onClick={() => setPreview(null)} className="btn-secondary text-sm flex-1 justify-center">
                      <RotateCcw size={14} /> Ulangi
                    </button>
                    <button onClick={handleConfirm} className="btn-primary text-sm flex-1 justify-center">
                      <Check size={15} /> Gunakan Foto
                    </button>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
