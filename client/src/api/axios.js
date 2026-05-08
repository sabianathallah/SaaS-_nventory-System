import axios from 'axios'
import toast from 'react-hot-toast'

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || '/api' })

// Module-level company scope — set by SelectedCompanyContext
let _scopedCompanyId = null
export function setAxiosCompanyScope(id) { _scopedCompanyId = id }

function getCompanyId() {
  if (_scopedCompanyId) return _scopedCompanyId
  try {
    const c = JSON.parse(sessionStorage.getItem('selectedCompany'))
    return c?.id ?? null
  } catch { return null }
}

// Routes that belong to Administration and should NEVER be company-scoped
const ADMIN_PATHS = ['/users', '/companies', '/roles', '/permissions', '/system', '/me']

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`

  const companyId = getCompanyId()
  if (companyId) {
    const url = config.url || ''
    const isAdminPath = ADMIN_PATHS.some(p => url.startsWith(p))
    if (!isAdminPath) {
      config.params = { ...(config.params || {}), companyId }
    }
  }

  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      const msg = err.response?.data?.message ?? ''
      const isExpired = msg.toLowerCase().includes('expired')
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      toast.error(isExpired ? 'Sesi berakhir, silakan login kembali.' : 'Tidak terautentikasi.')
      setTimeout(() => { window.location.href = '/login' }, 1500)
    }
    return Promise.reject(err)
  }
)

export default api
