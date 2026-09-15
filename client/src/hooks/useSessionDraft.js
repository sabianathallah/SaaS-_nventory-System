import { useState, useEffect, useCallback, useRef } from 'react'

export function useSessionDraft(key, defaultValue) {
  const defaultRef = useRef(defaultValue)

  const [state, setState] = useState(() => {
    try {
      const raw = localStorage.getItem(key)
      if (raw) return JSON.parse(raw)
    } catch {}
    return defaultRef.current
  })

  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(state))
  }, [key, state])

  const clearDraft = useCallback(() => {
    localStorage.removeItem(key)
    setState(defaultRef.current)
  }, [key])

  return [state, setState, clearDraft]
}

// Auto-save isian form ke localStorage tanpa merombak state form yang sudah
// pakai banyak useState. Restore sekali saat mount (via callback `restore`),
// lalu simpan setiap kali `values` berubah. Return: fungsi clear.
export function useFormAutosave(key, { enabled = true, values, restore }) {
  const restoreRef  = useRef(restore)
  const restoredRef = useRef(false)
  restoreRef.current = restore

  useEffect(() => {
    if (!enabled) { restoredRef.current = true; return }
    try {
      const raw = localStorage.getItem(key)
      if (raw) restoreRef.current(JSON.parse(raw))
    } catch {}
    restoredRef.current = true
  }, [key, enabled])

  useEffect(() => {
    if (!enabled || !restoredRef.current) return
    try { localStorage.setItem(key, JSON.stringify(values)) } catch {}
  }, [key, enabled, values])

  return useCallback(() => localStorage.removeItem(key), [key])
}
