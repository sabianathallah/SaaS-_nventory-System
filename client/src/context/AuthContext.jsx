import { createContext, useContext, useState, useCallback } from 'react'
import { login as loginApi } from '../api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('user')) } catch { return null }
  })

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

  // Check if user has a specific permission key
  const hasPermission = useCallback((key) => {
    if (!user) return false
    // SUPER_ADMIN always has everything
    if (user.role === 'SUPER_ADMIN') return true
    return Array.isArray(user.permissions) && user.permissions.includes(key)
  }, [user])

  const isSuperAdmin  = user?.role === 'SUPER_ADMIN'
  const isAdmin       = ['SUPER_ADMIN', 'ADMIN', 'COMPANY_ADMIN'].includes(user?.role)
  const isOperasional = ['SUPER_ADMIN', 'ADMIN', 'COMPANY_ADMIN', 'OPERASIONAL'].includes(user?.role)
  const isHeadPacking = ['SUPER_ADMIN', 'ADMIN', 'COMPANY_ADMIN', 'HEAD_PACKING'].includes(user?.role)
  const isTimPacking  = ['SUPER_ADMIN', 'ADMIN', 'COMPANY_ADMIN', 'TIM_PACKING'].includes(user?.role)
  const isHR          = ['SUPER_ADMIN', 'ADMIN', 'COMPANY_ADMIN', 'HR'].includes(user?.role)
  const canViewPacking = ['SUPER_ADMIN','ADMIN','COMPANY_ADMIN','OPERASIONAL','HEAD_PACKING','TIM_PACKING','HR','CEO'].includes(user?.role)

  return (
    <AuthContext.Provider value={{
      user, signIn, signOut, hasPermission,
      isSuperAdmin, isAdmin, isOperasional, isHeadPacking, isTimPacking, isHR, canViewPacking,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
