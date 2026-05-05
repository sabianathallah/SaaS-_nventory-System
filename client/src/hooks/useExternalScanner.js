import { useEffect, useRef } from 'react'

// Menangkap input dari external barcode scanner (USB/Bluetooth HID keyboard emulator).
// Scanner mengirim karakter sangat cepat lalu Enter — dibedakan dari ketikan manual
// via timeout 100ms antar karakter.
export function useExternalScanner(onScan, enabled) {
  const bufferRef = useRef('')
  const timerRef  = useRef(null)
  // Stable ref agar effect tidak perlu re-run saat onScan berubah
  const onScanRef = useRef(onScan)
  useEffect(() => { onScanRef.current = onScan }, [onScan])

  useEffect(() => {
    if (!enabled) return

    const handleKeyDown = (e) => {
      // Abaikan jika user sedang mengetik di input/textarea/select
      const tag = e.target.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

      if (e.key === 'Enter') {
        const code = bufferRef.current.trim()
        bufferRef.current = ''
        clearTimeout(timerRef.current)
        if (code.length > 2) onScanRef.current(code)
        return
      }

      if (e.key.length === 1) {
        bufferRef.current += e.key
        // Reset buffer kalau tidak ada karakter baru dalam 100ms (ketikan manual)
        clearTimeout(timerRef.current)
        timerRef.current = setTimeout(() => { bufferRef.current = '' }, 100)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      clearTimeout(timerRef.current)
      bufferRef.current = ''
    }
  }, [enabled])
}
