import { useEffect, useRef, useState } from 'react'
import { BrowserMultiFormatReader } from '@zxing/browser'
import { NotFoundException, BarcodeFormat, DecodeHintType } from '@zxing/library'
import { X, Keyboard, Zap } from 'lucide-react'

// Batasi format yang di-scan — jauh lebih cepat di HP dibanding scan semua format
const HINTS = new Map([
  [DecodeHintType.POSSIBLE_FORMATS, [
    BarcodeFormat.QR_CODE,
    BarcodeFormat.CODE_128,
    BarcodeFormat.EAN_13,
    BarcodeFormat.EAN_8,
    BarcodeFormat.CODE_39,
  ]],
])

export default function QRScanner({ onScan, onClose, hint = 'Arahkan kamera ke barcode / QR code produk', autoClose = true }) {
  const videoRef    = useRef(null)
  const controlsRef = useRef(null)
  const audioCtxRef = useRef(null)
  const cooldownRef = useRef(false)
  const onScanRef   = useRef(onScan)
  useEffect(() => { onScanRef.current = onScan }, [onScan])
  const [error,        setError]        = useState(null)
  const [manual,       setManual]       = useState('')
  const [showManual,   setShowManual]   = useState(false)
  const [lastScanned,  setLastScanned]  = useState(null)
  const [torchOn,      setTorchOn]      = useState(false)
  const [torchSupported, setTorchSupported] = useState(false)

  // Buat AudioContext saat komponen mount (masih dalam konteks user gesture)
  useEffect(() => {
    try {
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)()
      // Unlock di iOS: resume langsung
      audioCtxRef.current.resume()
    } catch {}
  }, [])

  function beep() {
    try {
      const ctx = audioCtxRef.current
      if (!ctx) return
      if (ctx.state === 'suspended') ctx.resume()
      const osc  = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.frequency.value = 1200
      osc.type = 'sine'
      gain.gain.setValueAtTime(0.4, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15)
      osc.start(ctx.currentTime)
      osc.stop(ctx.currentTime + 0.15)
    } catch {}
  }

  useEffect(() => {
    let cancelled = false
    const reader = new BrowserMultiFormatReader(HINTS)

    const checkTorch = () => {
      const track = videoRef.current?.srcObject?.getVideoTracks?.()?.[0]
      if (track?.getCapabilities?.()?.torch) setTorchSupported(true)
    }

    reader.decodeFromVideoDevice(undefined, videoRef.current, (result, err) => {
      if (cancelled) return
      if (result) {
        // Debounce: abaikan scan berikutnya selama 1.5 detik
        if (cooldownRef.current) return
        cooldownRef.current = true
        setTimeout(() => { cooldownRef.current = false }, 1500)

        const code = result.getText()
        beep()
        onScanRef.current(code)
        if (autoClose) {
          onClose()
        } else {
          setLastScanned(code)
          setTimeout(() => setLastScanned(null), 1200)
        }
      }
      if (err && !(err instanceof NotFoundException)) {
        setError('Kamera tidak dapat diakses. Gunakan input manual di bawah.')
        setShowManual(true)
      }
    })
      .then(controls => { controlsRef.current = controls; setTimeout(checkTorch, 500) })
      .catch(() => {
        setError('Tidak dapat membuka kamera. Pastikan izin kamera diberikan.')
        setShowManual(true)
      })

    return () => {
      cancelled = true
      // Matikan torch sebelum stop kamera
      const track = videoRef.current?.srcObject?.getVideoTracks?.()?.[0]
      track?.applyConstraints?.({ advanced: [{ torch: false }] }).catch(() => {})
      controlsRef.current?.stop()
      audioCtxRef.current?.close()
    }
  }, [])

  const toggleTorch = () => {
    const track = videoRef.current?.srcObject?.getVideoTracks?.()?.[0]
    if (!track) return
    const next = !torchOn
    track.applyConstraints({ advanced: [{ torch: next }] })
      .then(() => setTorchOn(next))
      .catch(() => {})
  }

  const submitManual = (e) => {
    e.preventDefault()
    if (!manual.trim()) return
    beep()
    onScan(manual.trim())
    if (autoClose) {
      onClose()
    } else {
      setLastScanned(manual.trim())
      setManual('')
      setTimeout(() => setLastScanned(null), 1200)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/80">
        <p className="text-white text-sm font-medium">Scan Barcode / QR</p>
        <div className="flex items-center gap-2">
          {torchSupported && (
            <button
              onClick={toggleTorch}
              className={`p-2 rounded-lg transition-colors ${torchOn ? 'bg-yellow-400 text-black' : 'text-white/60 hover:text-white hover:bg-white/10'}`}
              title="Flashlight"
            >
              <Zap size={18} />
            </button>
          )}
          <button onClick={onClose} className="text-white/70 hover:text-white p-1">
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Camera */}
      <div className="flex-1 relative flex items-center justify-center bg-black">
        <video ref={videoRef} className="w-full h-full object-cover" />

        {/* Viewfinder overlay */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="relative w-64 h-64">
            <span className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-white rounded-tl-sm" />
            <span className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-white rounded-tr-sm" />
            <span className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-white rounded-bl-sm" />
            <span className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-white rounded-br-sm" />
            {!error && (
              <div className="absolute left-2 right-2 top-1/2 h-0.5 bg-red-500/80 animate-scan-line" />
            )}
          </div>
        </div>

        {/* Scan success flash */}
        {lastScanned && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="bg-green-500/90 text-white text-sm font-semibold px-5 py-2.5 rounded-xl shadow-lg animate-fade-in">
              ✓ Ditambahkan
            </div>
          </div>
        )}

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
