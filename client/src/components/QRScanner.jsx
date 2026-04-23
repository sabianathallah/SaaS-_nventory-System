import { useEffect, useRef, useState } from 'react'
import { BrowserMultiFormatReader } from '@zxing/browser'
import { NotFoundException } from '@zxing/library'
import { X, Keyboard } from 'lucide-react'

export default function QRScanner({ onScan, onClose, hint = 'Arahkan kamera ke barcode / QR code produk' }) {
  const videoRef    = useRef(null)
  const controlsRef = useRef(null)
  const [error,    setError]    = useState(null)
  const [manual,   setManual]   = useState('')
  const [showManual, setShowManual] = useState(false)

  useEffect(() => {
    let cancelled = false
    const reader = new BrowserMultiFormatReader()

    reader.decodeFromVideoDevice(undefined, videoRef.current, (result, err) => {
      if (cancelled) return
      if (result) {
        onScan(result.getText())
        onClose()
      }
      if (err && !(err instanceof NotFoundException)) {
        setError('Kamera tidak dapat diakses. Gunakan input manual di bawah.')
        setShowManual(true)
      }
    })
      .then(controls => { controlsRef.current = controls })
      .catch(() => {
        setError('Tidak dapat membuka kamera. Pastikan izin kamera diberikan.')
        setShowManual(true)
      })

    return () => {
      cancelled = true
      controlsRef.current?.stop()
    }
  }, [])

  const submitManual = (e) => {
    e.preventDefault()
    if (manual.trim()) { onScan(manual.trim()); onClose() }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/80">
        <p className="text-white text-sm font-medium">Scan Barcode / QR</p>
        <button onClick={onClose} className="text-white/70 hover:text-white p-1">
          <X size={20} />
        </button>
      </div>

      {/* Camera */}
      <div className="flex-1 relative flex items-center justify-center bg-black">
        <video ref={videoRef} className="w-full h-full object-cover" />

        {/* Viewfinder overlay */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="relative w-64 h-64">
            {/* Corner brackets */}
            <span className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-white rounded-tl-sm" />
            <span className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-white rounded-tr-sm" />
            <span className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-white rounded-bl-sm" />
            <span className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-white rounded-br-sm" />
            {/* Scan line animation */}
            {!error && (
              <div className="absolute left-2 right-2 top-1/2 h-0.5 bg-red-500/80 animate-scan-line" />
            )}
          </div>
        </div>

        {/* Hint text */}
        <div className="absolute bottom-6 left-0 right-0 text-center">
          {error
            ? <p className="text-red-400 text-sm px-6">{error}</p>
            : <p className="text-white/70 text-xs px-6">{hint}</p>
          }
        </div>
      </div>

      {/* Bottom: manual fallback */}
      <div className="bg-black/90 px-4 py-4 space-y-3">
        <button
          onClick={() => setShowManual(v => !v)}
          className="flex items-center gap-2 text-white/60 hover:text-white text-sm transition-colors w-full justify-center"
        >
          <Keyboard size={15} />
          {showManual ? 'Tutup input manual' : 'Input manual (jika scan gagal)'}
        </button>

        {showManual && (
          <form onSubmit={submitManual} className="flex gap-2">
            <input
              autoFocus
              className="flex-1 bg-white/10 text-white placeholder-white/40 border border-white/20 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-white/60"
              placeholder="Ketik SKU / kode produk…"
              value={manual}
              onChange={e => setManual(e.target.value)}
            />
            <button type="submit" className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
              OK
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
