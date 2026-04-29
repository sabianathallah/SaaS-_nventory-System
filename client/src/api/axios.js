import axios from 'axios'

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || '/api' })

// Module-level company scope — set by SelectedCompanyContext
let _scopedCompanyId = null
export function setAxiosCompanyScope(id) { _scopedCompanyId = id }

// Routes that belong to Administration and should NEVER be company-scoped
const ADMIN_PATHS = ['/users', '/companies', '/role-permissions', '/system']

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`

  if (_scopedCompanyId) {
    const url = config.url || ''
    const isAdminPath = ADMIN_PATHS.some(p => url.startsWith(p))
    if (!isAdminPath) {
      config.params = { ...(config.params || {}), companyId: _scopedCompanyId }
    }
  }

  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export default api
