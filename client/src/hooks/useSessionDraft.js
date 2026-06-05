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
