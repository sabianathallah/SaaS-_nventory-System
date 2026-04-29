import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { systemApi } from '../api'

const PageVisibilityContext = createContext(null)

export function PageVisibilityProvider({ children }) {
  const [visibility, setVisibility] = useState(null)

  useEffect(() => {
    systemApi.getPageVisibility()
      .then(setVisibility)
      .catch(() => setVisibility({}))
  }, [])

  const isPageVisible = useCallback((key) => {
    if (!key) return true
    if (!visibility) return true
    return visibility[key] !== false
  }, [visibility])

  const refresh = useCallback(() => {
    systemApi.getPageVisibility().then(setVisibility).catch(() => {})
  }, [])

  return (
    <PageVisibilityContext.Provider value={{ visibility, setVisibility, isPageVisible, refresh }}>
      {children}
    </PageVisibilityContext.Provider>
  )
}

export const usePageVisibility = () => useContext(PageVisibilityContext)
