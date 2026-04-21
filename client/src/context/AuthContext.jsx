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

  const isSuperAdmin  = user?.role === 'SUPER_ADMIN'
  const isAdmin       = ['SUPER_ADMIN', 'ADMIN'].includes(user?.role)

  return (
    <AuthContext.Provider value={{ user, signIn, signOut, isSuperAdmin, isAdmin }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
