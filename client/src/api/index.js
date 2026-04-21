import api from './axios'

// ── Auth ──────────────────────────────────────────────────────────────────────
export const login = (data) => api.post('/login', data)

// ── Generic paginated fetcher ─────────────────────────────────────────────────
const list   = (url) => (params) => api.get(url, { params }).then(r => r.data)
const get    = (url) => (id)     => api.get(`${url}/${id}`).then(r => r.data)
const create = (url) => (data)   => api.post(url, data).then(r => r.data)
const update = (url) => (id, data) => api.put(`${url}/${id}`, data).then(r => r.data)
const remove = (url) => (id)     => api.delete(`${url}/${id}`).then(r => r.data)
const crud   = (url) => ({ list: list(url), get: get(url), create: create(url), update: update(url), remove: remove(url) })

// ── Resources ─────────────────────────────────────────────────────────────────
export const categoriesApi     = crud('/categories')
export const productsApi       = crud('/products')
export const warehousesApi     = crud('/warehouses')
export const suppliersApi      = crud('/suppliers')
export const stocksApi         = crud('/stocks')
export const stockInApi        = crud('/stock-in-headers')
export const stockOutApi       = crud('/stock-out-headers')
export const movementsApi      = crud('/stock-movements')
export const opnameSessionsApi = crud('/stock-opname-sessions')
export const opnameItemsApi    = crud('/stock-opname-items')
export const usersApi          = crud('/users')
export const companiesApi      = crud('/companies')
