import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { login as loginApi } from '../api'
import api from '../api/axios'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('user')) } catch { return null }
  })

  // Refresh permissions on app load so stale localStorage data is corrected
  useEffect(() => {
    if (!user) return
    const token = localStorage.getItem('token')
    if (!token) return
    api.get('/me/permissions')
      .then(res => {
        const updated = { ...user, permissions: res.data.permissions }
        localStorage.setItem('user', JSON.stringify(updated))
        setUser(updated)
      })
      .catch(() => {}) // silently ignore — offline or expired token
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const signIn = useCallback(async (email, password) => {
    const res = await loginApi({ email, password })
    localStorage.setItem('token', res.data.access_token)
    localStorage.setItem('user', JSON.stringify(res.data.user))
    setUser(res.data.user)
    return res.data.user
  }, [])

  const signOut = useCallback(() => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setUser(null)
  }, [])

  const hasPermission = useCallback((key) => {
    if (!user) return false
    if (user.role === 'SUPER_ADMIN' || user.role === 'COMPANY_ADMIN') return true
    return Array.isArray(user.permissions) && user.permissions.includes(key)
  }, [user])

  const isSuperAdmin   = user?.role === 'SUPER_ADMIN'
  const isAdmin        = ['SUPER_ADMIN', 'COMPANY_ADMIN'].includes(user?.role)
  const isOperasional  = ['SUPER_ADMIN', 'COMPANY_ADMIN', 'OPERASIONAL'].includes(user?.role)
  const isHeadPacking  = false
  const isTimPacking   = ['SUPER_ADMIN', 'COMPANY_ADMIN', 'TIM_PACKING'].includes(user?.role)
  const isHR           = false
  const isStaff        = user?.role === 'STAFF'
  const canViewPacking = user
    ? (user.role === 'SUPER_ADMIN' || user.role === 'COMPANY_ADMIN' ||
       Array.isArray(user.permissions) && user.permissions.includes('packing.view'))
    : false

  return (
    <AuthContext.Provider value={{
      user, signIn, signOut, hasPermission,
      isSuperAdmin, isAdmin, isOperasional, isHeadPacking, isTimPacking, isHR, isStaff, canViewPacking,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
