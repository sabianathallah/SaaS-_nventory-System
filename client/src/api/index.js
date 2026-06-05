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

// Convert an object (possibly containing a File) into FormData when an image
// is attached; otherwise fall back to plain JSON. Axios sets the right
// Content-Type automatically when given a FormData instance.
const toPayload = (data) => {
  if (!data || typeof data !== 'object') return data
  const hasFile = Object.values(data).some(value => value instanceof File)
  if (!hasFile) return data
  const fd = new FormData()
  for (const [k, v] of Object.entries(data)) {
    if (v === undefined || v === null) continue
    fd.append(k, v)
  }
  return fd
}

// ── Resources ─────────────────────────────────────────────────────────────────
export const dashboardApi  = { getStats: () => api.get('/dashboard/stats').then(r => r.data) }
export const categoriesApi = crud('/categories')
export const articlesApi   = crud('/articles')

export const productsApi = {
  ...crud('/products'),
  create: (data)     => api.post('/products', toPayload(data)).then(r => r.data),
  update: (id, data) => api.put(`/products/${id}`, toPayload(data)).then(r => r.data),
}

export const productVariantsApi = {
  getTypes:     (pid)           => api.get(`/products/${pid}/variant-types`).then(r => r.data),
  createType:   (pid, data)     => api.post(`/products/${pid}/variant-types`, data).then(r => r.data),
  deleteType:   (pid, tid)      => api.delete(`/products/${pid}/variant-types/${tid}`).then(r => r.data),
  createOption:  (pid, tid, data)  => api.post(`/products/${pid}/variant-types/${tid}/options`, data).then(r => r.data),
  deleteOption:  (pid, tid, oid)   => api.delete(`/products/${pid}/variant-types/${tid}/options/${oid}`).then(r => r.data),
  reorderOptions:(pid, tid, order) => api.patch(`/products/${pid}/variant-types/${tid}/options/reorder`, { order }).then(r => r.data),
  reorderTypes:  (pid, order)      => api.patch(`/products/${pid}/variant-types/reorder`, { order }).then(r => r.data),
}

export const productSkusApi = {
  list:   (pid)         => api.get(`/products/${pid}/skus`).then(r => r.data),
  create: (pid, data)   => api.post(`/products/${pid}/skus`, data).then(r => r.data),
  update: (pid, sid, d) => api.put(`/products/${pid}/skus/${sid}`, d).then(r => r.data),
  delete: (pid, sid)    => api.delete(`/products/${pid}/skus/${sid}`).then(r => r.data),
}
export const warehousesApi     = crud('/warehouses')
export const suppliersApi      = crud('/suppliers')
export const stocksApi         = crud('/stocks')
export const stockInApi = {
  ...crud('/stock-in-headers'),
  resolveSku: (code)              => api.get('/stock-in-headers/resolve-sku', { params: { code } }).then(r => r.data),
  addItem:    (id, data)          => api.post(`/stock-in-headers/${id}/items`, data).then(r => r.data),
  updateItem: (id, itemId, data)  => api.put(`/stock-in-headers/${id}/items/${itemId}`, data).then(r => r.data),
  removeItem: (id, itemId)        => api.delete(`/stock-in-headers/${id}/items/${itemId}`).then(r => r.data),
}
export const stockOutApi       = crud('/stock-out-headers')
export const stockInDraftApi = {
  ensure:     ()                   => api.post('/stock-in-drafts/ensure').then(r => r.data),
  update:     (id, data)           => api.put(`/stock-in-drafts/${id}`, data).then(r => r.data),
  addItem:    (id, data)           => api.post(`/stock-in-drafts/${id}/items`, data).then(r => r.data),
  updateItem: (id, itemId, data)   => api.put(`/stock-in-drafts/${id}/items/${itemId}`, data).then(r => r.data),
  removeItem: (id, itemId)         => api.delete(`/stock-in-drafts/${id}/items/${itemId}`).then(r => r.data),
  submit:     (id, data)           => api.post(`/stock-in-drafts/${id}/submit`, data).then(r => r.data),
  cancel:     (id)                 => api.delete(`/stock-in-drafts/${id}`).then(r => r.data),
}
export const stockOutDraftApi = {
  ensure:     ()                   => api.post('/stock-out-drafts/ensure').then(r => r.data),
  update:     (id, data)           => api.put(`/stock-out-drafts/${id}`, data).then(r => r.data),
  addItem:    (id, data)           => api.post(`/stock-out-drafts/${id}/items`, data).then(r => r.data),
  updateItem: (id, itemId, data)   => api.put(`/stock-out-drafts/${id}/items/${itemId}`, data).then(r => r.data),
  removeItem: (id, itemId)         => api.delete(`/stock-out-drafts/${id}/items/${itemId}`).then(r => r.data),
  submit:     (id, data)           => api.post(`/stock-out-drafts/${id}/submit`, data).then(r => r.data),
  cancel:     (id)                 => api.delete(`/stock-out-drafts/${id}`).then(r => r.data),
}
export const movementsApi = {
  ...crud('/stock-movements'),
  summary: (params) => api.get('/stock-movements/summary', { params }).then(r => r.data),
  chart:   (params) => api.get('/stock-movements/chart',   { params }).then(r => r.data),
  exportCsv: (params) => api.get('/stock-movements/export/csv', { params, responseType: 'blob' }).then(r => r.data),
}
export const opnameSessionsApi = crud('/stock-opname-sessions')
export const opnameItemsApi    = crud('/stock-opname-items')
export const usersApi          = crud('/users')
export const companiesApi      = {
  ...crud('/companies'),
  create: (data) => api.post('/companies', toPayload(data)).then(r => r.data),
  update: (id, data) => api.put(`/companies/${id}`, toPayload(data)).then(r => r.data),
}

// ── Packing Module ────────────────────────────────────────────────────────────
export const vendorsApi = crud('/vendors')

export const incomingGoodsApi = {
  ...crud('/incoming-goods'),
  confirmVendor:    (id, data) => api.post(`/incoming-goods/${id}/confirm-vendor`, data).then(r => r.data),
  notifyProduction: (id, data) => api.post(`/incoming-goods/${id}/notify-production`, data).then(r => r.data),
  complete:         (id)       => api.post(`/incoming-goods/${id}/complete`).then(r => r.data),
  updateItem:       (id, itemId, data) => api.put(`/incoming-goods/${id}/items/${itemId}`, data).then(r => r.data),
}

export const suratJalanApi = {
  list:        (params) => api.get('/surat-jalan', { params }).then(r => r.data),
  get:         (id)     => api.get(`/surat-jalan/${id}`).then(r => r.data),
  markPrinted: (id)     => api.post(`/surat-jalan/${id}/print`).then(r => r.data),
}

export const packingJobsApi = {
  list:       (params)     => api.get('/packing-jobs', { params }).then(r => r.data),
  get:        (id)         => api.get(`/packing-jobs/${id}`).then(r => r.data),
  create:     (data)       => api.post('/packing-jobs', data).then(r => r.data),
  start:      (id)         => api.post(`/packing-jobs/${id}/start`).then(r => r.data),
  submit:     (id, data)   => api.post(`/packing-jobs/${id}/submit`, data).then(r => r.data),
  verify:     (id, data)   => api.post(`/packing-jobs/${id}/verify`, data).then(r => r.data),
  getWorkers: (params)     => api.get('/packing-jobs/workers', { params }).then(r => r.data),
}

export const formAnakPackingApi = {
  list: (params) => api.get('/form-anak-packing', { params }).then(r => r.data),
  get:  (id)     => api.get(`/form-anak-packing/${id}`).then(r => r.data),
}

export const rolesApi = {
  getAll:  (params)                => api.get('/roles', { params }).then(r => r.data),
  create:  (name, displayName)     => api.post('/roles', { name, displayName }).then(r => r.data),
  update:  (id, displayName, permissions) => api.put(`/roles/${id}`, { displayName, permissions }).then(r => r.data),
  destroy: (id)                    => api.delete(`/roles/${id}`).then(r => r.data),
}

export const permissionsApi = {
  getAll: () => api.get('/permissions').then(r => r.data),
}

export const handoverApi = {
  list:       (params)     => api.get('/handovers', { params }).then(r => r.data),
  get:        (id)         => api.get(`/handovers/${id}`).then(r => r.data),
  create:     (data)       => api.post('/handovers', data).then(r => r.data),
  update:     (id, data)   => api.put(`/handovers/${id}`, data).then(r => r.data),
  destroy:    (id)         => api.delete(`/handovers/${id}`).then(r => r.data),
  addResi:    (id, resi)   => api.post(`/handovers/${id}/items`, { resi }).then(r => r.data),
  removeResi: (id, itemId) => api.delete(`/handovers/${id}/items/${itemId}`).then(r => r.data),
}

export const systemApi = {
  getPageVisibility:    ()     => api.get('/system/page-visibility').then(r => r.data),
  updatePageVisibility: (data) => api.put('/system/page-visibility', data).then(r => r.data),
}
